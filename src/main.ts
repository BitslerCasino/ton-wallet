import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { json } from 'express';

import * as dotenv from 'dotenv';
dotenv.config();

import config from './config';
const { version } = require('../package.json');

import { AppModule } from './app/app.module';
import { ChainService } from './app/chain/chain.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe());
  app.use(json({ limit: '50mb' }));
  await app.listen(config.PORT);
  return app;
}
bootstrap().then(async (app) => {
  Logger.log(
    `ton-wallet version ${version} running on port ${config.PORT} with env ${config.NODE_ENV}`,
  );
  // Start listening new blocks
  await app.get(ChainService).init();
});
