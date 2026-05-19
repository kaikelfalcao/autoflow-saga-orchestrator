import { Nack, RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import { Injectable, Logger } from "@nestjs/common";

import { SagaService } from "../saga.service";

interface Envelope<T> {
  sagaId?: string;
  payload: T;
}

interface StockReservedPayload {
  sagaId: string;
  osId: string;
  reservationId: string;
}

interface StockInsufficientPayload {
  sagaId: string;
  osId: string;
  failures: Array<{ partId: string; requested: number; available: number }>;
}

interface StockConsumedPayload {
  sagaId: string;
  osId: string;
  reservationId: string;
}

interface ReservationReleasedPayload {
  sagaId: string;
  osId: string;
  reservationId: string;
}

@Injectable()
export class CatalogRepliesConsumer {
  private readonly logger = new Logger(CatalogRepliesConsumer.name);

  constructor(private readonly sagaService: SagaService) {}

  @RabbitSubscribe({
    exchange: "oficina.replies",
    routingKey: "stock.stock-reserved",
    queue: "saga.catalog.stock-reserved",
    queueOptions: { durable: true },
  })
  async onStockReserved(
    msg: Envelope<StockReservedPayload>,
  ): Promise<Nack | void> {
    try {
      await this.sagaService.handleStockReserved(msg.payload);
    } catch (err) {
      this.logger.error(
        `Failed stock.stock-reserved: ${(err as Error).message}`,
        (err as Error).stack,
      );
      return new Nack(false);
    }
  }

  @RabbitSubscribe({
    exchange: "oficina.replies",
    routingKey: "stock.stock-insufficient",
    queue: "saga.catalog.stock-insufficient",
    queueOptions: { durable: true },
  })
  async onStockInsufficient(
    msg: Envelope<StockInsufficientPayload>,
  ): Promise<Nack | void> {
    try {
      await this.sagaService.handleStockInsufficient(msg.payload);
    } catch (err) {
      this.logger.error(
        `Failed stock.stock-insufficient: ${(err as Error).message}`,
        (err as Error).stack,
      );
      return new Nack(false);
    }
  }

  @RabbitSubscribe({
    exchange: "oficina.replies",
    routingKey: "stock.stock-consumed",
    queue: "saga.catalog.stock-consumed",
    queueOptions: { durable: true },
  })
  async onStockConsumed(
    msg: Envelope<StockConsumedPayload>,
  ): Promise<Nack | void> {
    try {
      await this.sagaService.handleStockConsumed(msg.payload);
    } catch (err) {
      this.logger.error(
        `Failed stock.stock-consumed: ${(err as Error).message}`,
        (err as Error).stack,
      );
      return new Nack(false);
    }
  }

  @RabbitSubscribe({
    exchange: "oficina.replies",
    routingKey: "stock.reservation-released",
    queue: "saga.catalog.reservation-released",
    queueOptions: { durable: true },
  })
  async onReservationReleased(
    msg: Envelope<ReservationReleasedPayload>,
  ): Promise<Nack | void> {
    try {
      await this.sagaService.handleReservationReleased(msg.payload);
    } catch (err) {
      this.logger.error(
        `Failed stock.reservation-released: ${(err as Error).message}`,
        (err as Error).stack,
      );
      return new Nack(false);
    }
  }
}
