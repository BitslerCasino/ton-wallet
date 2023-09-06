import {
  IsNotEmpty,
  IsString,
  IsPositive,
  Min,
  IsNumberString,
} from 'class-validator';

export default class WithdrawDTO {
  @IsNotEmpty()
  @IsString()
  to: string;

  @IsNotEmpty()
  @IsNumberString()
  amount: string;
}
