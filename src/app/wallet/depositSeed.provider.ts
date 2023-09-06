import { Param, ParamName } from '@app/database/entities/param.entity';
import { Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import BIP32Factory, { BIP32Interface } from 'bip32';
import * as bip39 from 'bip39';
import * as ecc from 'tiny-secp256k1';

import config from '@app/config';

const DEPOSIT_SEED = 'DEPOSIT_SEED';

type DepositSeed = {
  node: BIP32Interface;
  baseDerivationPath: string;
};

const depositSeedProvider = {
  provide: DEPOSIT_SEED,
  useFactory: async (datasource: DataSource) => {
    const repository = datasource.getRepository(Param);
    let mnemonic = await repository.findOneBy({
      name: ParamName.DEPOSIT_SEED,
    });
    if (mnemonic === null) {
      Logger.debug('No deposit seed in database: generate a mnemonic');
      const words = bip39.generateMnemonic(256);
      mnemonic = await repository.create({
        name: ParamName.DEPOSIT_SEED,
        value: words,
      });
      await repository.save(mnemonic);
    } else {
      Logger.debug('Using deposit seed stored in database');
    }
    const bip39seed = bip39.mnemonicToSeedSync(mnemonic.value);
    const bip32 = BIP32Factory(ecc);
    const node: BIP32Interface = bip32.fromSeed(bip39seed);
    return {
      node,
      baseDerivationPath: config.BASE_DERIVATION_PATH,
    };
  },
  inject: [DataSource],
};

export { DEPOSIT_SEED, depositSeedProvider, DepositSeed };
