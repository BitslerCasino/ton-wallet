import { Controller, Get } from '@nestjs/common';

import config from '@app/config';

@Controller()
export class AppController {
  @Get()
  getInfos(): { version: string; env: string } {
    const { version } = require('../../package.json');

    return {
      version,
      env: config.NODE_ENV,
    };
  }

  @Get('auth')
  getInfosAuthenticated(): { version: string; env: string } {
    return this.getInfos();
  }
}
