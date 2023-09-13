import TonWeb from 'tonweb';
import { Injectable, Logger } from '@nestjs/common';
import { SignKeyPair } from 'tweetnacl';
import * as tonMnemonic from 'tonweb-mnemonic';
import Decimal from 'decimal.js';
const TW = require('tonweb');

import config from '@app/config';
import PQueue from 'p-queue';
import { WalletV3ContractR2 } from 'tonweb/dist/types/contract/wallet/v3/wallet-v3-contract-r2';
import { ExplorerService } from './explorer.service';

@Injectable()
export class ProviderService {
  private logger = new Logger(ProviderService.name);
  private tonweb: TonWeb;

  private downloadBlocksQueue: PQueue = new PQueue({ concurrency: 30 });

  constructor(private readonly explorerService: ExplorerService) {
    this.tonweb = new TW(
      new TW.HttpProvider(`${config.TONWEB_PROVIDER_URL}/jsonRPC`),
    );
    this.logger.debug(
      `Provider use ton-http-api at: ${config.TONWEB_PROVIDER_URL}`,
    );
  }

  async getKeypairFromMnemonic(mnemonic: string): Promise<SignKeyPair> {
    const seed = await tonMnemonic.mnemonicToSeed(mnemonic.split(' '));
    return TW.utils.nacl.sign.keyPair.fromSeed(seed);
  }

  async getKeypairFromSeed(seed: Buffer): Promise<SignKeyPair> {
    return TW.utils.nacl.sign.keyPair.fromSeed(seed);
  }

  async getWalletFromKeypair(keyPair: SignKeyPair): Promise<{
    address: string;
    userFriendlyAddress: string;
    wallet: WalletV3ContractR2;
  }> {
    const wallet = this.tonweb.wallet.create({
      publicKey: keyPair.publicKey,
      wc: 0,
    });
    const address = await wallet.getAddress();
    return {
      address: address.toString(),
      userFriendlyAddress: address.toString(true, true, true),
      wallet,
    };
  }

  async getTONBalance(address: string): Promise<number> {
    const balance = await this.retry(() =>
      this.tonweb.getBalance(new TW.utils.Address(address)),
    );
    return this.toTON(new Decimal(balance)).toNumber();
  }

  toTON(value: Decimal): Decimal {
    return value.div(new Decimal(10 ** 9));
  }

  async getLastMasterChainBlockNumber(): Promise<number> {
    return (await this.retry(() => this.tonweb.provider.getMasterchainInfo()))
      .last.seqno;
  }

  async getMasterChainBlockHeader(blockNumber: number): Promise<any> {
    return this.retry(() =>
      this.tonweb.provider.getMasterchainBlockHeader(blockNumber),
    );
  }

  async getBlockHeader(
    workchain: number,
    shard: string,
    blockNumber: number,
  ): Promise<any> {
    return this.retry(() =>
      this.tonweb.provider.getBlockHeader(workchain, shard, blockNumber),
    );
  }

  async getBlockTransactions(blockHeader: any): Promise<any[]> {
    const { workchain, shard, seqno: blockNumber } = blockHeader;
    const result = await this.retry(() =>
      this.tonweb.provider.getBlockTransactions(workchain, shard, blockNumber),
    );
    return result.transactions;
  }

  async getBlocksRangeByWorkchain(
    from: number,
    to: number,
    workchain: number,
  ): Promise<any[]> {
    const shards = [];
    for (let blockNumber = from; blockNumber <= to; blockNumber++) {
      shards.push(
        this.downloadBlocksQueue.add(async () => {
          const block = await this.retry(() =>
            this.tonweb.provider.getBlockShards(blockNumber),
          );
          if (block && block.shards && Array.isArray(block.shards))
            return block.shards.filter(
              ({ workchain: shardWC }) => shardWC === workchain,
            );
          return [];
        }),
      );
    }
    return await Promise.all(shards).then((shards) =>
      shards.flatMap((shard) => shard.flat()),
    );
  }

  async getBlocksHeader(
    blocks: { workchain: number; shard: string; seqno: number }[],
  ): Promise<any[]> {
    const headers = [];
    for (const { workchain, shard, seqno } of blocks) {
      headers.push(
        this.downloadBlocksQueue.add(() =>
          this.getBlockHeader(workchain, shard, seqno),
        ),
      );
    }
    return Promise.all(headers);
  }

  async getTransaction(
    address: string,
    hash: string,
    lt: number,
  ): Promise<any> {
    const result = await this.retry(() =>
      this.tonweb.provider.getTransactions(address, 1, lt, hash),
    );
    if (result && Array.isArray(result) && result.length > 0) return result[0];
    return null;
  }

  async sweep(
    signer: SignKeyPair,
    wallet: WalletV3ContractR2,
    destinationWalletAddress: string,
  ): Promise<any> {
    const transfer = wallet.methods.transfer({
      secretKey: signer.secretKey,
      toAddress: destinationWalletAddress,
      amount: 0,
      seqno: 0,
      sendMode: 128 + 32, // mode 128 is used for messages that are to carry all the remaining balance; mode 32 means that the current account must be destroyed if its resulting balance is zero;
    });

    const message = await transfer.getQuery();
    const encoded = this.tonweb.utils.bytesToBase64(await message.toBoc(false));
    return this.tonweb.provider.send('sendBocReturnHash', { boc: encoded });
  }

  async transfer(
    signer: SignKeyPair,
    wallet: WalletV3ContractR2,
    destinationWalletAddress: string,
    amount: Decimal,
  ): Promise<{ hash: string; fees: number }> {
    const seqno = await this.retry(() => wallet.methods.seqno().call());
    const transfer = wallet.methods.transfer({
      secretKey: signer.secretKey,
      toAddress: destinationWalletAddress,
      amount: amount
        .mul(new Decimal(10 ** 9))
        .floor()
        .toNumber(),
      seqno,
    });
    const message = await transfer.getQuery();
    const encoded = this.tonweb.utils.bytesToBase64(await message.toBoc(false));
    const res = (await this.tonweb.provider.send('sendBocReturnHash', {
      boc: encoded,
    })) as any;
    const { hash: messageHash } = res;
    let txDetails = null;
    await this.wait(10);
    for (let count = 0; count < 10; count++) {
      txDetails = await this.explorerService.getTxByMessageHash(messageHash);
      if (txDetails !== null) break;
      await this.wait(2);
    }
    if (txDetails) {
      // We retrieved tx details: return tx hash + fees
      return {
        hash: txDetails.hash,
        fees: this.toTON(new Decimal(txDetails.fee)).toNumber(),
      };
    }
    this.logger.warn(
      `No wd details retrieved after 10 tries. messageHash=${messageHash} toAddress=${destinationWalletAddress}`,
    );
    // No tx details: return message hash
    return {
      hash: messageHash,
      fees: 0,
    };
  }

  isAddressValid(address: string): boolean {
    return this.tonweb.utils.Address.isValid(address);
  }

  private async retry<T>(
    func: () => Promise<T>,
    maxTimes = 3,
    delay = 1000,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      let times = 0;
      const retryInternal = () => {
        func()
          .then(resolve)
          .catch((err) => {
            times++;
            if (times < maxTimes) {
              setTimeout(retryInternal, delay);
            } else {
              reject(err);
            }
          });
      };
      retryInternal();
    });
  }

  private wait(sec: number) {
    return new Promise((resolve) => setTimeout(resolve, sec * 1000));
  }
}

export { SignKeyPair };
