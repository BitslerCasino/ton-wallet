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
});

export default env;
