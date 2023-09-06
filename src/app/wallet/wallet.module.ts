import { Param } from '@app/database/entities/param.entity';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProviderModule } from '../provider/provider.module';
import { WalletService } from './wallet.service';
import { masterWalletProvider } from './masterWallet.provider';
import { WalletController } from './wallet.controller';
import { depositSeedProvider } from './depositSeed.provider';
import { Address } from '@app/database/entities/address.entity';
import { SweepService } from './sweep.service';
import { Balance } from '@app/database/entities/balance.entity';
import { Transfer } from '@app/database/entities/transfer.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Param, Address, Balance, Transfer]),
    ProviderModule,
  ],
  controllers: [WalletController],
  providers: [
    WalletService,
    SweepService,
    masterWalletProvider,
    depositSeedProvider,
  ],
  exports: [WalletService],
})
export class WalletModule {}
