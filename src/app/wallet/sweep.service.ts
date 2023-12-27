import { Balance } from '@app/database/entities/balance.entity';
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, MoreThan, Not, Repository } from 'typeorm';
import { WalletService } from './wallet.service';
import { Transfer } from '@app/database/entities/transfer.entity';
import { KYTService } from './kyt.service';

@Injectable()
export class SweepService {
  private logger = new Logger(SweepService.name);
  private state: 'idle' | 'updating' | 'sweeping' = 'idle';

  constructor(
    @InjectRepository(Balance)
    private readonly balanceRepository: Repository<Balance>,
    @InjectRepository(Transfer)
    private readonly tansferRepository: Repository<Transfer>,
    private readonly walletService: WalletService,
    private readonly kytService: KYTService,
  ) {}

  @Cron(
    '1,2,4,5,6,9,10,13,14,17,18,21,22,25,26,29,30,33,34,37,38,41,42,45,46,49,50,53,54,57,58 * * * *',
  )
  async updateBalances() {
    if (this.state === 'idle') {
      const startTime = Date.now();
      this.logger.debug('Update balances');
      this.state = 'updating';
      try {
        const balancesToUpdate = await this.balanceRepository.find({
          where: { needUpdate: true, currency: 'TON' },
        });
        for (const { address, currency } of balancesToUpdate) {
          const amount = await this.walletService.getWalletBalance(address);
          await this.balanceRepository.update(
            {
              address,
              currency,
            },
            {
              needUpdate: false,
              amount,
            },
          );
        }
        if (balancesToUpdate.length > 0)
          this.logger.log(
            `${balancesToUpdate.length} balance(s) updated in ${Math.round(
              (Date.now() - startTime) / 1000,
            )}s`,
          );
      } catch (error) {
        this.logger.error(error);
      } finally {
        this.state = 'idle';
      }
    }
  }

  @Cron('3,7,11,15,19,23,27,31,35,39,43,47,51,55,59 * * * *')
  async sweep() {
    if (this.state === 'idle') {
      const startTime = Date.now();
      this.logger.debug('Sweep deposit addresses');
      this.state = 'sweeping';
      try {
        let totalSweeps = 0;
        const balancesToSweep = await this.balanceRepository.find({
          where: {
            needUpdate: false,
            amount: MoreThan(0.01), // Min sweep amount for TON - sweep fees are +/- 0.006794002 TON
            currency: 'TON',
          },
          relations: ['_address'],
        });
        for (const balance of balancesToSweep) {
          // Check address version
          const addressVersion = await this.walletService.getAddressVersion(
            balance.address,
          );

          const { canSweep } =
            addressVersion < 2 // Do not move to quarantine for wallet version < 2
              ? { canSweep: true }
              : await this.kytService.processKYT(balance.address);
          if (!canSweep) {
            this.logger.log(
              `Address ${balance.address} has pending/blocking KYT deposits: wait before sweeping address`,
            );
            continue;
          }
          await this.walletService.sweepAddress(
            balance._address,
            addressVersion,
          );
          totalSweeps++;
        }
        this.logger.log(
          `${totalSweeps} addresses swept in ${Math.round(
            (Date.now() - startTime) / 1000,
          )}s`,
        );
        await this.clearOldTransfers();
      } catch (error) {
        this.logger.error(error);
      } finally {
        this.state = 'idle';
      }
    }
  }

  private async clearOldTransfers(): Promise<void> {
    // Remove transfers for more than 100 days
    await this.tansferRepository.delete({
      lastUpdatedAt: LessThan(new Date(Date.now() - 100 * 24 * 60 * 60 * 1000)),
    });
  }
}
