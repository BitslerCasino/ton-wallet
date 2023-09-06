import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSourceConfig } from '@app/database/datasource';

import { APIAuthenticationGuard } from './auth/auth.guard';
import { AuthModule } from './auth/auth.module';
import { ProviderModule } from './provider/provider.module';
import { WalletModule } from './wallet/wallet.module';
import { ChainModule } from './chain/chain.module';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    TypeOrmModule.forRoot(DataSourceConfig),
    ScheduleModule.forRoot(),
    AuthModule,
    ProviderModule,
    WalletModule,
    ChainModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: APIAuthenticationGuard,
    },
  ],
})
export class AppModule {}
