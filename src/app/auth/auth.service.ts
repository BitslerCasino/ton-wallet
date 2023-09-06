import { Injectable, Logger } from '@nestjs/common';
import { createDecipheriv } from 'crypto';

import config from '@app/config';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  private secretKey: Buffer;

  constructor() {
    this.secretKey = Buffer.from(config.API_AUTH_SECRET_KEY, 'hex');
  }

  validateApiKey(apiKey: string): { success: boolean; appname?: string } {
    try {
      const iv = apiKey.slice(0, 32);
      const encrypted = apiKey.slice(32);

      const decipher = createDecipheriv(
        'aes-256-cbc',
        this.secretKey,
        Buffer.from(iv, 'hex'),
      );
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      if (!decrypted || decrypted.length === 0) {
        this.logger.warn(`Invalid API key used ${apiKey}`);
        return { success: false };
      }

      return {
        success: true,
        appname: decrypted,
      };
    } catch (e) {
      this.logger.error(`Error on API key validation: ${apiKey}`);
      return { success: false };
    }
  }
}
