import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Mutex } from 'async-mutex';
import { DataSource, Repository } from 'typeorm';

import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { Param, ParamName } from '@app/database/entities/param.entity';
import { ProviderService } from '@app/app/provider/provider.service';
import { MASTER_WALLET, MasterWallet } from './masterWallet.provider';
import { DEPOSIT_SEED, DepositSeed } from './depositSeed.provider';
import { Address } from '@app/database/entities/address.entity';
import { Balance } from '@app/database/entities/balance.entity';
import { Transfer } from '@app/database/entities/transfer.entity';
import Decimal from 'decimal.js';
import { ExplorerService } from '../provider/explorer.service';

@Injectable()
export class WalletService {
  private logger = new Logger(WalletService.name);
  private generateAddressMutex: Mutex = new Mutex();

  constructor(
    @InjectDataSource() private readonly datasource: DataSource,
    @Inject(MASTER_WALLET) private readonly masterWallet: MasterWallet,
    @Inject(DEPOSIT_SEED) private readonly depositSeed: DepositSeed,
    @InjectRepository(Address)
    private readonly addressRepository: Repository<Address>,
    @InjectRepository(Balance)
    private readonly balanceRepository: Repository<Balance>,
    @InjectRepository(Transfer)
    private readonly transferRepository: Repository<Transfer>,
    private readonly providerService: ProviderService,
    private readonly explorerService: ExplorerService,
  ) {
    this.logger.debug(
      `Master wallet address is: ${masterWallet.userFriendlyAddress}`,
    );
  }

  getMasterWalletAddress(): string {
    return this.masterWallet.userFriendlyAddress;
  }

  getMasterWalletBalance(): Promise<number> {
    return this.getWalletBalance(this.masterWallet.address);
  }

  getWalletBalance(address: string): Promise<number> {
    return this.providerService.getTONBalance(address);
  }

  async getNewAddress(): Promise<string> {
    const address = await this.generateAddressMutex.runExclusive(async () =>
      this.datasource.transaction(async (entityManager) => {
        const lastIndex = await entityManager.findOne(Param, {
          where: { name: ParamName.LAST_INDEX },
        });
        const nextIndex: number =
          lastIndex !== null ? parseInt(lastIndex.value) + 1 : 1;

        const path = `${this.depositSeed.baseDerivationPath}/${nextIndex}`;
        const child = this.depositSeed.node.derivePath(path);
        const keyPair = await this.providerService.getKeypairFromSeed(
          child.privateKey,
        );
        const { address, userFriendlyAddress } =
          await this.providerService.getWalletFromKeypair(keyPair);
        const nextAddress = await entityManager.create(Address, {
          address: address.toString(),
          userFriendlyAddress,
          path,
        });
        await entityManager.save(nextAddress);
        const newLastInddex = await entityManager.create(Param, {
          name: ParamName.LAST_INDEX,
          value: nextIndex.toString(),
        });
        await entityManager.save(newLastInddex);
        return userFriendlyAddress;
      }),
    );
    return address;
  }

  isDepositAddress(address: string): Promise<boolean> {
    return this.addressRepository.exist({ where: { address } });
  }

  async sweepAddress(address: Address): Promise<void> {
    // First, retrieve the private key
    const node = this.depositSeed.node.derivePath(address.path);
    const keyPair = await this.providerService.getKeypairFromSeed(
      node.privateKey,
    );
    const { wallet } = await this.providerService.getWalletFromKeypair(keyPair);

    const destination = this.getMasterWalletAddress();
    this.logger.debug(
      `Sweeping wallet ${address.userFriendlyAddress} to ${destination}`,
    );
    try {
      const result = await this.providerService.sweep(
        keyPair,
        wallet,
        destination,
      );
      if (result && result.hash) {
        // Insert transfer
        this.logger.log(`Sweep hash: ${result.hash}`);
        const transfer = new Transfer();
        transfer.currency = 'TON';
        transfer.fromAddress = address.address;
        transfer.fromUserFriendly = address.userFriendlyAddress;
        transfer.toUserFriendly = destination;
        transfer.type = 'internal';
        transfer.hash = result.hash;
        transfer.amount = null;
        await this.transferRepository.save(transfer);
      } else {
        this.logger.error(
          `An error occured during sweep: ${JSON.stringify(result)}`,
        );
      }
    } catch (error) {
      this.logger.error(`An error occured during sweep: ${error}}`);
    }
    // Force balance update
    const balance = this.balanceRepository.create({
      address: address.address,
      currency: 'TON',
      needUpdate: true,
    });
    await this.balanceRepository.save(balance);
  }

  async withdrawal(
    toAddress: string,
    amount: Decimal,
  ): Promise<{ hash: string; fees: number }> {
    if (!this.providerService.isAddressValid(toAddress))
      throw new BadRequestException(
        'Invalid destination address: ' + toAddress,
      );
    const { wallet, userFriendlyAddress, address } =
      await this.providerService.getWalletFromKeypair(
        this.masterWallet.keypair,
      );
    this.logger.debug(
      `Withdrawal from hot wallet ${userFriendlyAddress} to ${toAddress} for ${amount} TON`,
    );
    const { hash, fees } = await this.providerService.transfer(
      this.masterWallet.keypair,
      wallet,
      toAddress,
      amount,
    );
    // Insert transfer
    this.logger.log(`Withdrawal hash: ${hash}`);
    const transfer = new Transfer();
    transfer.currency = 'TON';
    transfer.fromAddress = address;
    transfer.fromUserFriendly = userFriendlyAddress;
    transfer.toUserFriendly = toAddress;
    transfer.type = 'external';
    transfer.hash = hash;
    transfer.amount = amount.toNumber();
    await this.transferRepository.save(transfer);

    return { hash, fees };
  }
}
