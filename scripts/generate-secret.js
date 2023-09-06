const crypto = require('crypto');

const secret = crypto.randomBytes(32);

console.log(secret.toString('hex'));
