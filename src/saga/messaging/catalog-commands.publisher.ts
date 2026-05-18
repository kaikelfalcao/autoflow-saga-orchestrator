import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';

import { SagaItem } from '../entities/saga.orm-entity';

const EXCHANGE = 'oficina.commands';
const SOURCE = 'saga-orchestrator';
const VERSION = '1.0';

interface Envelope<T> {
  eventId: string;
  correlationId: string;
  sagaId: string;
  occurredAt: string;
  version: string;
  source: string;
  payload: T;
}

@Injectable()
export class CatalogCommandsPublisher {
  constructor(private readonly amqp: AmqpConnection) {}

  async publishReserveStock(params: {
    sagaId: string;
    osId: string;
    items: SagaItem[];
  }): Promise<void> {
    await this.publish('stock.reserve-stock', params.sagaId, {
      osId: params.osId,
      items: params.items,
    });
  }

  async publishConsumeStock(params: {
    sagaId: string;
    osId: string;
    reservationId: string;
  }): Promise<void> {
    await this.publish('stock.consume-stock', params.sagaId, {
      osId: params.osId,
      reservationId: params.reservationId,
    });
  }

  async publishReleaseReservation(params: {
    sagaId: string;
    osId: string;
    reservationId: string;
  }): Promise<void> {
    await this.publish('stock.release-reservation', params.sagaId, {
      osId: params.osId,
      reservationId: params.reservationId,
    });
  }

  private async publish<T>(
    routingKey: string,
    sagaId: string,
    payload: T,
  ): Promise<void> {
    const envelope: Envelope<T> = {
      eventId: uuidv4(),
      correlationId: uuidv4(),
      sagaId,
      occurredAt: new Date().toISOString(),
      version: VERSION,
      source: SOURCE,
      payload,
    };
    await this.amqp.publish(EXCHANGE, routingKey, envelope);
  }
}
