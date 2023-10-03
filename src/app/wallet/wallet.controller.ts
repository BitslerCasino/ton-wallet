import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
} from '@nestjs/common';
import { WalletService } from './wallet.service';
import WithdrawDTO from '../dto/withdraw.dto';
import { ProviderService } from '../provider/provider.service';
import Decimal from 'decimal.js';

@Controller('ton/wallet')
export class WalletController {
  constructor(
    private readonly walletService: WalletService,
    private readonly providerService: ProviderService,
  ) {}

  @Get('new')
  async getNewWallet(): Promise<{ address: string }> {
    const address = await this.walletService.getNewAddress();
    return { address };
  }

  @Get('master/address')
  getMasterWallet(): { address: string } {
    return { address: this.walletService.getMasterWalletAddress() };
  }

  @Get('master/balance')
  async getMasterWalletBalance(): Promise<{ value: number }> {
    return {
      value: await this.walletService.getMasterWalletBalance(),
    };
  }

  @Post('master/transaction')
  async transferFromMaster(
    @Body() dto: WithdrawDTO,
  ): Promise<{ txid: string; fees: { value: number } }> {
    const amount = new Decimal(dto.amount);
    if (amount.toNumber() < 0.1)
      throw new BadRequestException('Min amount: 0.1 TON');
    const { hash, fees } = await this.walletService.withdrawal(dto.to, amount);
    return {
      txid: hash,
      fees: { value: fees },
    };
  }

  @Get(':address/format-valid')
  isValidAddressFormat(@Param('address') address): { valid: boolean } {
    return { valid: this.providerService.isAddressValid(address) };
  }
}
