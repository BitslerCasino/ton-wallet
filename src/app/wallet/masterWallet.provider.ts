import { Param, ParamName } from '@app/database/entities/param.entity';
import { Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as tonMnemonic from 'tonweb-mnemonic';

import { ProviderService, SignKeyPair } from '../provider/provider.service';

const MASTER_WALLET = 'MASTER_WALLET';

type MasterWallet = {
  keypair: SignKeyPair;
  address: string;
  userFriendlyAddress: string;
};

const masterWalletProvider = {
  provide: MASTER_WALLET,
  useFactory: async (datasource: DataSource, provider: ProviderService) => {
    const repository = datasource.getRepository(Param);
    let mnemonic = await repository.findOneBy({
      name: ParamName.HOT_MNEMONIC,
    });
    if (mnemonic === null) {
      Logger.debug('No mnemonic in database: generate a new master wallet');
      const words = await tonMnemonic.generateMnemonic();
      mnemonic = await repository.create({
        name: ParamName.HOT_MNEMONIC,
        value: words.join(' '),
      });
      await repository.save(mnemonic);
    } else {
      Logger.debug('Using menmonic stored in database');
    }
    const keypair = await provider.getKeypairFromMnemonic(mnemonic.value);
    const address = await provider.getWalletFromKeypair(keypair);
    return { keypair, ...address };
  },
  inject: [DataSource, ProviderService],
};

export { MASTER_WALLET, masterWalletProvider, MasterWallet };
