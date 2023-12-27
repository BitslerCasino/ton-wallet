import { cleanEnv, str, num, url, bool } from 'envalid';

const env = cleanEnv(process.env, {
  NODE_ENV: str({ choices: ['DEV', 'TEST', 'PROD'], default: 'PROD' }),
  PORT: num({ default: 3000 }),

  API_AUTH_SECRET_KEY: str(),

  TONWEB_PROVIDER_URL: url(),
  EXPLORER_URL: url(),

  SQLITE_DATABASE: str(),
  SQLITE_LOG: bool({ default: false }),

  BASE_DERIVATION_PATH: str({ default: "m/44'/607'/0'" }),

  NOTIFY_URL: url(),

  BLOCK_CONCURRENCY: num({ default: 20 }),
  INTERVAL: num({ default: 1000 }),
  INTERVAL_CAP: num({ default: 60 }),
  LAST_BLOCK_DELAY: num({ default: 20 }),

  GET_KYT_STATUS_URL: url(),
});

export default env;
