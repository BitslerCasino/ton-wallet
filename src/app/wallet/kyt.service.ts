import axios, { AxiosInstance } from 'axios';
import { Deposit, KYTStatus } from '@app/database/entities/deposit.entity';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProviderService } from '../provider/provider.service';
import { WalletService } from './wallet.service';
import { Transfer } from '@app/database/entities/transfer.entity';

import config from '@app/config';
import Decimal from 'decimal.js';

@Injectable()
export class KYTService {
  private logger = new Logger(KYTService.name);
  private backend: AxiosInstance;

  constructor(
    @InjectRepository(Deposit)
    private readonly depositRepository: Repository<Deposit>,
    private readonly providerService: ProviderService,
    private readonly walletService: WalletService,
    @InjectRepository(Transfer)
    private readonly transferRepository: Repository<Transfer>,
  ) {
    const pkgjson = require('../../../package.json');
    const userAgent = `${
      pkgjson.name.charAt(0).toUpperCase() + pkgjson.name.substr(1)
    }/${pkgjson.version} (Node.js ${process.version})`;
    this.backend = axios.create({
      baseURL: config.GET_KYT_STATUS_URL,
      timeout: 5_000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': userAgent,
      },
    });
  }

  async processKYT(address: string): Promise<{ canSweep: boolean }> {
    const pendingDeposits = await this.depositRepository.find({
      where: {
        toUserFriendly: this.providerService.toInternalAddressFormat(address),
        kytStatus: KYTStatus.PENDING,
      },
    });
    let hasPending = false;
    for (const deposit of pendingDeposits) {
      this.logger.debug(
        `Get KYT status for pending deposit ${deposit.hash} (to = ${deposit.toUserFriendly})`,
      );
      try {
        const status = await this.getBackendStatus(
          deposit.toUserFriendly,
          deposit.hash,
        );
        if (status === 'pending') {
          this.logger.debug(`KYT status for tx ${deposit.hash} still pending`);
          hasPending = true;
          break;
        } else if (status === 'ok') {
          this.logger.debug(`KYT status OK for tx ${deposit.hash}`);
          await this.depositRepository.update(
            { hash: deposit.hash },
            { kytStatus: KYTStatus.OK },
          );
        } else if (status === 'alerts') {
          this.logger.warn(`KYT status ALERT for tx ${deposit.hash}`);
          await this.depositRepository.update(
            { hash: deposit.hash },
            { kytStatus: KYTStatus.HAS_ALERT },
          );
        }
      } catch (error) {
        return { canSweep: false };
      }
    }
    if (hasPending) return { canSweep: false };
    const blockingDeposits = await this.depositRepository.find({
      where: {
        toUserFriendly: this.providerService.toInternalAddressFormat(address),
        kytStatus: KYTStatus.HAS_ALERT,
      },
    });
    if (blockingDeposits.length > 0) {
      const total = blockingDeposits.reduce(
        (acc: Decimal, depo) => acc.add(depo.amount),
        new Decimal(0),
      );
      this.logger.warn(
        `${
          blockingDeposits.length
        } deposit(s) with bad KYT status: transfer ${total.toNumber()} TON from ${this.providerService.toInternalAddressFormat(
          address,
        )} to quarantine`,
      );

      const transferOK = await this.walletService.moveToQuarantine(
        address,
        total,
      );
      if (transferOK) {
        for (const depo of blockingDeposits) {
          await this.depositRepository.update(
            { hash: depo.hash },
            { kytStatus: KYTStatus.TRANSFERRED_TO_QUARANTINE },
          );
        }
      }
    }
    return {
      canSweep: blockingDeposits.length === 0,
    };
  }

  private async getBackendStatus(
    to: string,
    hash: string,
  ): Promise<'ok' | 'pending' | 'alerts'> {
    try {
      const result = await this.backend.post(
        '',
        JSON.stringify({
          to,
          hash,
          currency: 'ton',
          network: 'ton',
        }),
      );
      if (
        ['ok', 'pending', 'alerts'].includes(result?.data?.status) === false
      ) {
        this.logger.error('Invalid status returned', result.data);
        throw new Error(`Invalid response from ${config.GET_KYT_STATUS_URL}`);
      }
      return result.data.status;
    } catch (error) {
      const message = error?.response?.data?.message || '';
      this.logger.error(
        `An error occured during call to backend ti get KYT status for txhash ${hash}: ${error.message}: ${message}`,
      );
      throw new Error(`Invalid response from ${config.GET_KYT_STATUS_URL}`);
    }
  }
}
