import {
  Deposit,
  DepositStatus,
  KYTStatus,
} from '@app/database/entities/deposit.entity';
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios, { AxiosInstance } from 'axios';

import config from '@app/config';

@Injectable()
export class NotifyService {
  private logger = new Logger(NotifyService.name);
  private state: 'idle' | 'processing' = 'idle';
  private backend: AxiosInstance;

  constructor(
    @InjectRepository(Deposit)
    private readonly depositRepository: Repository<Deposit>,
  ) {
    // Init Axios client for communication to
    const pkgjson = require('../../../package.json');
    const userAgent = `${
      pkgjson.name.charAt(0).toUpperCase() + pkgjson.name.substr(1)
    }/${pkgjson.version} (Node.js ${process.version})`;
    this.backend = axios.create({
      baseURL: config.NOTIFY_URL,
      timeout: 5_000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': userAgent,
      },
    });
  }

  @Cron(CronExpression.EVERY_5_SECONDS)
  async retryNotification() {
    // Avoid parallel execution of the cron
    if (this.state === 'idle') {
      try {
        this.state = 'processing';
        const confirmedDeposits = await this.depositRepository
          .createQueryBuilder('deposit')
          .where('status in (:...statuses)', {
            statuses: [DepositStatus.NOTIF_ERR, DepositStatus.CONFIRMED],
          })
          .andWhere('(nextRetry is null or nextRetry <= :now)', {
            now: new Date(),
          })
          .orderBy('createdAt', 'ASC')
          .getMany();
        for (const deposit of confirmedDeposits) {
          await this.notify(deposit);
        }
        await this.clearOldDeposits();
      } catch (error) {
        this.logger.error(error);
      } finally {
        this.state = 'idle';
      }
    }
  }

  async notify(deposit: Deposit): Promise<void> {
    const result = await this.callBackend(deposit);
    if (result.success) {
      const { kytEnabled } = result;
      this.logger.log(
        `Notification OK for hash ${deposit.hash} - kyt enabled ? ${kytEnabled}`,
      );
      await this.depositRepository.update(
        { hash: deposit.hash },
        {
          status: DepositStatus.NOTIF_OK,
          kytStatus: kytEnabled ? KYTStatus.PENDING : null,
        },
      );
    } else {
      if (deposit.retries < 10) {
        const retryDelay = 5 * 1.7 ** deposit.retries; // interval * (exponentialRate ** retry)
        const nextRetry = new Date(Date.now() + retryDelay * 1000);
        await this.depositRepository.update(
          { hash: deposit.hash },
          {
            status: DepositStatus.NOTIF_ERR,
            retries: deposit.retries + 1,
            nextRetry,
          },
        );
        this.logger.warn(
          `Notification failed for deposit with hash ${
            deposit.hash
          }, will retry in ${Math.round(retryDelay)} seconds`,
        );
      } else {
        await this.depositRepository.update(
          { hash: deposit.hash },
          {
            status: DepositStatus.NOTIF_FAILED,
            nextRetry: null,
          },
        );
        this.logger.error(
          `Notification failed for deposit with hash ${deposit.hash} after ${deposit.retries} retry`,
        );
      }
    }
  }

  private async clearOldDeposits(): Promise<void> {
    // Remove deposit OK for more than 10 days with KYTStatus NULL or OK or TRANSFERRED_TO_QUARANTINE
    await this.depositRepository
      .createQueryBuilder('deposits')
      .delete()
      .from(Deposit)
      .where(
        'status = :statusNotifOK and lastUpdatedAt <= :10daysAgo and (kytStatus is null or kytStatus in (:...kytToRemove))',
        {
          statusNotifOK: DepositStatus.NOTIF_OK,
          '10daysAgo': new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
          kytToRemove: [KYTStatus.OK, KYTStatus.TRANSFERRED_TO_QUARANTINE],
        },
      )
      .execute();
  }

  private async callBackend(
    deposit: Deposit,
  ): Promise<{ success: true; kytEnabled: boolean } | { success: false }> {
    try {
      const result = await this.backend.post(
        '',
        JSON.stringify({
          hash: deposit.hash,
          amount: deposit.amount,
          from: deposit.fromUserFriendly,
          to: deposit.toUserFriendly,
          network: 'ton',
          currency: 'ton',
        }),
      );
      const kytEnabled = result.data?.kytEnabled || false;
      return {
        success: result.status === 200,
        kytEnabled,
      };
    } catch (error) {
      this.logger.error(
        `An error occured during call to backend for hash ${deposit.hash}: ${error.message}`,
      );
      this.logger.debug(
        `deposit data = from:${deposit.fromUserFriendly} to:${deposit.toUserFriendly} amount:${deposit.amount}`,
      );
      return {
        success: false,
      };
    }
  }
}
