const crypto = require('crypto');
const dotenv = require('dotenv');
const { cleanEnv, str } = require('envalid');

dotenv.config();

const { API_AUTH_SECRET_KEY } = cleanEnv(process.env, {
  API_AUTH_SECRET_KEY: str(),
});

const checkArgs = () => {
  if (process.argv.length !== 3) {
    console.error('Error! Usage: node ./scripts/generate-api-key.js {appname}');
    process.exit(1);
  }
  return {
    appname: process.argv[2],
  };
};

const { appname } = checkArgs();
const secret = Buffer.from(API_AUTH_SECRET_KEY, 'hex');

const iv = crypto.randomBytes(16);
const cipher = crypto.createCipheriv('aes-256-cbc', secret, iv);
let ciphered = cipher.update(appname, 'utf8', 'hex');
ciphered += cipher.final('hex');
const result = `${iv.toString('hex')}${ciphered}`;

console.log(result);
