import {
  Entity,
  PrimaryColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Column,
} from 'typeorm';

export enum DepositStatus {
  PENDING = 'pending',
  NOTIF_ERR = 'notif-err',
  NOTIF_OK = 'notif-ok',
  NOTIF_FAILED = 'notif-failed',
}

@Entity()
export class Deposit {
  @PrimaryColumn({ nullable: false, length: 44 })
  hash: string;

  @Column({ nullable: false, length: 100 })
  lt: string;

  @Column({
    nullable: false,
    length: 11,
    default: DepositStatus.PENDING,
  })
  status: DepositStatus;

  @Column({ nullable: false, default: 0 })
  retries: number;

  @Column({ nullable: true })
  nextRetry: Date | null;

  @PrimaryColumn({ nullable: false, length: 100 })
  fromAddress: string;

  @Column({ nullable: false, length: 100 })
  fromUserFriendly: string;

  @Column({ nullable: false, length: 100 })
  toUserFriendly: string;

  @Column({ nullable: false, type: 'float' })
  amount: number;

  @Column({ nullable: false, length: 100 })
  wcBlockNumber: string;

  @Column({ nullable: false, length: 100 })
  shard: string;

  @Column({ nullable: false })
  workchain: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  lastUpdatedAt: Date;
}
