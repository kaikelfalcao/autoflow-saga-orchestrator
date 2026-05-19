import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { AppRabbitMqModule } from './messaging/rabbitmq.module';
import { SagaModule } from './saga/saga.module';
import { validateEnv } from './shared/config/env.config';
import { LoggerModule } from './shared/logger/logger.module';
import { CorrelationIdMiddleware } from './shared/middlewares/correlation-id.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    LoggerModule,
    DatabaseModule,
    AppRabbitMqModule,
    SagaModule,
    HealthModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
