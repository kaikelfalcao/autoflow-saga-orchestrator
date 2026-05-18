import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Global()
@Module({
  imports: [
    RabbitMQModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        uri:
          cfg.get<string>('RABBITMQ_URL') ?? 'amqp://admin:admin@localhost:5672',
        exchanges: [
          { name: 'order.events', type: 'topic' },
          { name: 'oficina.commands', type: 'topic' },
          { name: 'oficina.replies', type: 'topic' },
        ],
        connectionInitOptions: { wait: true, timeout: 20000 },
      }),
    }),
  ],
  exports: [RabbitMQModule],
})
export class AppRabbitMqModule {}
