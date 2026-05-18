// eslint-disable-next-line @typescript-eslint/no-require-imports
require('newrelic');
import 'reflect-metadata';
import 'dotenv/config';

import { NestFactory } from '@nestjs/core';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));
  const port = Number(process.env.APP_PORT ?? 3002);
  await app.listen(port);
}

void bootstrap();
