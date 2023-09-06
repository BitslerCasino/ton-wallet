import { DataSource } from 'typeorm';
import { SqliteConnectionOptions } from 'typeorm/driver/sqlite/SqliteConnectionOptions';
import { join } from 'path';
import * as dotenv from 'dotenv';
dotenv.config();

import config from '../config';

export const DataSourceConfig: SqliteConnectionOptions = {
  type: 'sqlite',
  entities: [join(__dirname, '**', '*.entity.{ts,js}')],
  synchronize: config.NODE_ENV === 'DEV',
  logging: config.SQLITE_LOG,
  database: config.SQLITE_DATABASE,
  migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
  migrationsRun: config.NODE_ENV !== 'DEV',
};

export default new DataSource(DataSourceConfig);
