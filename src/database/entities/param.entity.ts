export enum ParamName {
  HOT_MNEMONIC = 'hotMnemonic',
  QUARANTINE_MNEMONIC = 'quarantineMnemonic',
  DEPOSIT_SEED = 'depositSeed',
  LAST_INDEX = 'lastIndex',
  LAST_MC_BLOCK_NUMBER = 'lastMcBlockNumber',
}

import {
  Entity,
  PrimaryColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Column,
} from 'typeorm';

@Entity()
export class Param {
  @PrimaryColumn()
  name: ParamName;

  @Column()
  value: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  lastUpdatedAt: Date;
}
