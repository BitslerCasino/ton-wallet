import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression, SchedulerRegistry } from '@nestjs/schedule';
import { ProviderService } from '../provider/provider.service';
import { Param, ParamName } from '@app/database/entities/param.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WalletService } from '../wallet/wallet.service';
import { Deposit } from '@app/database/entities/deposit.entity';
import Decimal from 'decimal.js';
import { Balance } from '@app/database/entities/balance.entity';

const CRON_FETCH_BLOCKS = 'fetch-blocks';
const bigNumberFormatter = new Intl.NumberFormat('en-US');

@Injectable()
export class ChainService {
  private logger = new Logger(ChainService.name);
  private lastFetchedMasterchainNumber: number;
  private startLT: number;
  private state: 'syncing' | 'idle' = 'idle';

  constructor(
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly providerService: ProviderService,
    private readonly walletService: WalletService,
    @InjectRepository(Param)
    private readonly paramRepository: Repository<Param>,
    @InjectRepository(Deposit)
    private readonly depositRepository: Repository<Deposit>,
    @InjectRepository(Balance)
    private readonly balanceRepository: Repository<Balance>,
  ) {}

  async init() {
    // Get the last (masterchain) fetched block number from database, if exists
    const lastFetchedMCBlockParam = await this.paramRepository.findOne({
      where: { name: ParamName.LAST_MC_BLOCK_NUMBER },
    });
    const lastFetchedMCBlockNumber =
      lastFetchedMCBlockParam !== null
        ? parseInt(lastFetchedMCBlockParam.value)
        : NaN;

    if (isNaN(lastFetchedMCBlockNumber)) {
      // If not found in db, get the latest known block number
      this.lastFetchedMasterchainNumber =
        (await this.providerService.getLastMasterChainBlockNumber()) - 10;
      this.logger.log(
        `No last block number in database for masterchain: start with latest know block: ${this.lastFetchedMasterchainNumber}`,
      );
      // Insert the last fetched number in database
      this.paramRepository.insert({
        name: ParamName.LAST_MC_BLOCK_NUMBER,
        value: this.lastFetchedMasterchainNumber.toString(),
      });
    } else {
      // Re-process the latest 10 blocks
      this.lastFetchedMasterchainNumber = lastFetchedMCBlockNumber - 10;
    }

    // Fetch the initial logical time
    const startMcBlockHeader =
      await this.providerService.getMasterChainBlockHeader(
        this.lastFetchedMasterchainNumber,
      );

    this.startLT = parseInt(startMcBlockHeader.end_lt);

    // Start the internal cron to fetch new blocks
    this.schedulerRegistry.getCronJob(CRON_FETCH_BLOCKS).start();
  }

  @Cron(CronExpression.EVERY_5_SECONDS, {
    disabled: true, // activated by init method when wallet is ready
    name: CRON_FETCH_BLOCKS,
  })
  async processNewBlocks() {
    // Avoid parallel execution of the cron
    if (this.state === 'idle') {
      try {
        this.state = 'syncing';

        const lastKnownBlockNumber =
          await this.providerService.getLastMasterChainBlockNumber();
        const numberOfBlocks =
          lastKnownBlockNumber - this.lastFetchedMasterchainNumber;
        // Only download new blocks if we have at least 1 block to download
        if (numberOfBlocks > 5) {
          // Limit the number of blocks to download to 20
          const latestBlock =
            this.lastFetchedMasterchainNumber +
            1 +
            Math.min(
              lastKnownBlockNumber - this.lastFetchedMasterchainNumber,
              100,
            );
          const startTime = Date.now();
          this.logger.debug(
            `syncing masterchain blocks: ${bigNumberFormatter.format(
              this.lastFetchedMasterchainNumber + 1,
            )} to ${bigNumberFormatter.format(latestBlock)}`,
          );

          let nbDeposits = 0;

          // Get block shards from provider for workchain 0
          const blocks = await this.providerService.getBlocksRangeByWorkchain(
            this.lastFetchedMasterchainNumber + 1,
            latestBlock,
            0,
          );

          const missedPrevBlocks = (
            await this.providerService.getBlocksHeader(blocks)
          )
            .map((block) => {
              if (parseInt(block.end_lt) < this.startLT) return [];
              const missedPrevBlocks = block.prev_blocks.filter(
                ({ seqno, shard, workchain }) =>
                  workchain === 0 &&
                  blocks.some(
                    (_) =>
                      _.seqno === seqno &&
                      _.shard === shard &&
                      _.workchain === workchain,
                  ) === false,
              );
              return missedPrevBlocks;
            })
            .flat();

          for (const blockHeader of blocks.concat(missedPrevBlocks)) {
            const { seqno: wcBlockNumber } = blockHeader;
            const transactions =
              await this.providerService.getBlockTransactions(blockHeader);

            for (const tx of transactions) {
              const isDepositAddress =
                await this.walletService.isDepositAddress(tx.account);
              if (isDepositAddress) {
                const isNew = await this.processNewDeposit(tx, blockHeader);
                if (isNew) nbDeposits++;
              }
            }
          }

          const duration = Date.now() - startTime;
          this.logger.debug(
            `${
              latestBlock - (this.lastFetchedMasterchainNumber + 1)
            } masterchain blocks synced in ${Math.round(
              duration / 1000,
            )} seconds with ${nbDeposits} new deposit(s)`,
          );

          // Update last fetch block numbers in database
          this.lastFetchedMasterchainNumber = latestBlock;
          this.paramRepository.update(
            { name: ParamName.LAST_MC_BLOCK_NUMBER },
            { value: this.lastFetchedMasterchainNumber.toString() },
          );
        }
      } catch (error) {
        console.error(error);
        this.logger.error(error);
      } finally {
        this.state = 'idle';
      }
    }
  }

  private async processNewDeposit(tx: any, blockHeader: any): Promise<boolean> {
    // Check if deposit is already saved in db
    const exists = await this.depositRepository.findOne({
      where: { hash: tx.hash },
    });
    if (exists) return false;
    const details = await this.providerService.getTransaction(
      tx.account,
      tx.hash,
      parseInt(tx.lt),
    );
    if (details === null) {
      this.logger.error(
        `Cannot get detail of transaction (hash=${tx.hash} lt=${tx.lt})`,
      );
      return false;
    }
    if (details.out_msgs.length > 0) {
      this.logger.warn(
        `Transaction (hash=${tx.hash} lt=${tx.lt}) has out_msgs: reject it`,
      );
      return false;
    }
    const value = this.providerService.toTON(
      new Decimal(parseInt(details.in_msg.value)),
    );
    this.logger.debug(
      `hash=${tx.hash} lt=${tx.lt} from=${details.in_msg.source} to=${details.in_msg.destination} value=${value}`,
    );
    const deposit = new Deposit();
    deposit.hash = tx.hash;
    deposit.lt = tx.lt;
    deposit.fromAddress = tx.account;
    deposit.fromUserFriendly = details.in_msg.source;
    deposit.toUserFriendly = details.in_msg.destination;
    deposit.amount = value.toNumber();
    deposit.wcBlockNumber = blockHeader.seqno;
    deposit.shard = blockHeader.shard;
    deposit.workchain = blockHeader.workchain;
    await this.depositRepository.insert(deposit);
    await this.balanceRepository.upsert(
      {
        address: tx.account,
        currency: 'TON',
        needUpdate: true,
        lastUpdatedAt: new Date(),
      },
      ['address', 'currency'],
    );
    return true;
  }
}
