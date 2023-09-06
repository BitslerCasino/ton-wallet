import {
  Entity,
  PrimaryColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Column,
} from 'typeorm';

@Entity()
export class Transfer {
  @PrimaryColumn({ nullable: false, length: 64 })
  hash: string;

  @Column({ nullable: false, length: 100 })
  fromAddress: string;

  @Column({ nullable: false, length: 100 })
  fromUserFriendly: string;

  @Column({ nullable: false, length: 100 })
  toUserFriendly: string;

  @Column({ nullable: false, length: 8 })
  type: 'internal' | 'external';

  @Column({ nullable: false, length: 5 })
  currency: string;

  @Column({ nullable: true, type: 'float' })
  amount: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  lastUpdatedAt: Date;
}
