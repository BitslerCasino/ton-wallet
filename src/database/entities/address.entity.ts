import {
  Entity,
  PrimaryColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Column,
  OneToMany,
} from 'typeorm';
import { Balance } from './balance.entity';

@Entity()
export class Address {
  @PrimaryColumn({ nullable: false, length: 100 })
  address: string;

  @Column({ nullable: false, length: 100 })
  userFriendlyAddress: string;

  @Column({ nullable: false, length: 100 })
  path: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  lastUpdatedAt: Date;

  @OneToMany(() => Balance, (balance) => balance._address)
  public balances: Balance[];
}
