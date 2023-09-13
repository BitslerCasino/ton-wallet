import { Module } from '@nestjs/common';
import { ProviderService } from './provider.service';
import { ExplorerService } from './explorer.service';

@Module({
  imports: [],
  controllers: [],
  providers: [ProviderService, ExplorerService],
  exports: [ProviderService, ExplorerService],
})
export class ProviderModule {}
