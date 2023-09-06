import {
  Entity,
  PrimaryColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Address } from './address.entity';

@Entity()
export class Balance {
  @PrimaryColumn({ nullable: false, length: 100 })
  address: string;

  @PrimaryColumn({ nullable: false, length: 5, default: 'TON' })
  currency: string;

  @Column({ nullable: false, type: 'float', default: 0 })
  amount: number;

  @Column({ nullable: true, default: true })
  needUpdate: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  lastUpdatedAt: Date;

  @ManyToOne(() => Address, (address) => address.balances)
  @JoinColumn({ name: 'address' })
  _address: Address;
}
