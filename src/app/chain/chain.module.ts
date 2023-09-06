import { Module } from '@nestjs/common';
import { ProviderModule } from '@app/app/provider/provider.module';
import { ChainService } from './chain.service';
import { Param } from '@app/database/entities/param.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Deposit } from '@app/database/entities/deposit.entity';
import { WalletModule } from '../wallet/wallet.module';
import { NotifyService } from './notify.service';
import { Balance } from '@app/database/entities/balance.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Param, Deposit, Balance]),
    ProviderModule,
    WalletModule,
  ],
  controllers: [],
  providers: [ChainService, NotifyService],
  exports: [],
})
export class ChainModule {}
