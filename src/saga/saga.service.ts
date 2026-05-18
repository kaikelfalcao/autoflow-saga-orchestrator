import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

import { recordBusinessEvent } from '../shared/observability/business-events';
import { OrderServiceClient } from './clients/order-service.client';
import { SagaItem, SagaOrmEntity } from './entities/saga.orm-entity';
import { SagaStatus, TERMINAL_STATUSES } from './enums/saga-status.enum';
import { CatalogCommandsPublisher } from './messaging/catalog-commands.publisher';

export interface StockReservedReply {
  sagaId: string;
  osId: string;
  reservationId: string;
}

export interface StockInsufficientReply {
  sagaId: string;
  osId: string;
  failures: Array<{ partId: string; requested: number; available: number }>;
}

export interface StockConsumedReply {
  sagaId: string;
  osId: string;
  reservationId: string;
}

export interface ReservationReleasedReply {
  sagaId: string;
  osId: string;
  reservationId: string;
}

@Injectable()
export class SagaService {
  private readonly logger = new Logger(SagaService.name);

  constructor(
    @InjectRepository(SagaOrmEntity)
    private readonly sagaRepo: Repository<SagaOrmEntity>,
    private readonly publisher: CatalogCommandsPublisher,
    private readonly orderClient: OrderServiceClient,
  ) {}

  async handleBudgetApproved(orderId: string): Promise<void> {
    const existing = await this.findActiveByOrderId(orderId);
    if (existing) {
      this.logger.warn(
        `Saga already exists for order ${orderId} (status=${existing.status}); skipping`,
      );
      return;
    }

    const order = await this.orderClient.getOrder(orderId);
    const items: SagaItem[] = order.items
      .filter((i) => i.itemType === 'PART')
      .map((i) => ({ partId: i.catalogItemId, quantity: i.quantity }));

    if (items.length === 0) {
      this.logger.log(`Order ${orderId} has no PART items; saga not needed`);
      return;
    }

    const saga = this.sagaRepo.create({
      id: uuidv4(),
      sagaId: uuidv4(),
      orderId,
      osId: orderId,
      items,
      status: SagaStatus.RESERVING,
      reservationId: null,
      failureReason: null,
    });
    const saved = await this.sagaRepo.save(saga);

    await this.publisher.publishReserveStock({
      sagaId: saved.sagaId,
      osId: saved.osId,
      items,
    });
    this.logger.log(`Saga ${saved.sagaId} started for order ${orderId}`);
  }

  async handleStockReserved(reply: StockReservedReply): Promise<void> {
    const saga = await this.sagaRepo.findOne({ where: { sagaId: reply.sagaId } });
    if (!saga) {
      this.logger.warn(`Saga ${reply.sagaId} not found for stock-reserved reply`);
      return;
    }
    if (saga.status === SagaStatus.RESERVED) return;
    const startedAt = new Date(saga.createdAt as unknown as string | number | Date).getTime();
    saga.status = SagaStatus.RESERVED;
    saga.reservationId = reply.reservationId;
    await this.sagaRepo.save(saga);
    this.logger.log(`Saga ${reply.sagaId} → RESERVED (${reply.reservationId})`);
    recordBusinessEvent('SagaReserved', {
      sagaId: saga.sagaId,
      orderId: saga.orderId,
      reservationId: reply.reservationId,
      elapsedMs: Date.now() - startedAt,
    });
  }

  async handleStockInsufficient(reply: StockInsufficientReply): Promise<void> {
    const saga = await this.sagaRepo.findOne({ where: { sagaId: reply.sagaId } });
    if (!saga) {
      this.logger.warn(`Saga ${reply.sagaId} not found for stock-insufficient`);
      return;
    }
    if (saga.status === SagaStatus.RESERVATION_FAILED) {
      this.logger.warn(`Saga ${reply.sagaId} already RESERVATION_FAILED; skipping`);
      return;
    }
    const reason = `Stock insufficient: ${reply.failures
      .map((f) => `partId=${f.partId} requested=${f.requested} available=${f.available}`)
      .join('; ')}`;
    saga.status = SagaStatus.RESERVATION_FAILED;
    saga.failureReason = reason;
    await this.sagaRepo.save(saga);
    recordBusinessEvent('SagaReservationFailed', {
      sagaId: saga.sagaId,
      orderId: saga.orderId,
      reason: reason.slice(0, 240),
      failureCount: reply.failures.length,
    });
    try {
      await this.orderClient.cancelOrder(saga.orderId, reason);
      this.logger.log(`Saga ${reply.sagaId} → RESERVATION_FAILED; order cancelled`);
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 400) {
        this.logger.warn(
          `Order ${saga.orderId} cannot be cancelled (likely already terminal); saga remains RESERVATION_FAILED`,
        );
        return;
      }
      throw err;
    }
  }

  async handleExecutionCompleted(orderId: string): Promise<void> {
    const saga = await this.findActiveByOrderId(orderId);
    if (!saga) {
      this.logger.warn(`No active saga for order ${orderId}; skipping consume`);
      return;
    }
    if (saga.status !== SagaStatus.RESERVED || !saga.reservationId) {
      this.logger.warn(
        `Saga ${saga.sagaId} status=${saga.status}; cannot consume (must be RESERVED)`,
      );
      return;
    }
    saga.status = SagaStatus.CONSUMING;
    await this.sagaRepo.save(saga);
    await this.publisher.publishConsumeStock({
      sagaId: saga.sagaId,
      osId: saga.osId,
      reservationId: saga.reservationId,
    });
    this.logger.log(`Saga ${saga.sagaId} → CONSUMING`);
  }

  async handleStockConsumed(reply: StockConsumedReply): Promise<void> {
    const saga = await this.sagaRepo.findOne({ where: { sagaId: reply.sagaId } });
    if (!saga) {
      this.logger.warn(`Saga ${reply.sagaId} not found for stock-consumed reply`);
      return;
    }
    if (saga.status === SagaStatus.CONSUMED) return;
    const startedAt = new Date(saga.createdAt as unknown as string | number | Date).getTime();
    saga.status = SagaStatus.CONSUMED;
    await this.sagaRepo.save(saga);
    this.logger.log(`Saga ${reply.sagaId} → CONSUMED`);
    recordBusinessEvent('SagaConsumed', {
      sagaId: saga.sagaId,
      orderId: saga.orderId,
      reservationId: reply.reservationId,
      totalElapsedMs: Date.now() - startedAt,
    });
  }

  async handleOrderCancelled(orderId: string): Promise<void> {
    const saga = await this.findActiveByOrderId(orderId);
    if (!saga) {
      this.logger.log(`No active saga for order ${orderId}; nothing to release`);
      return;
    }
    if (saga.status !== SagaStatus.RESERVED || !saga.reservationId) {
      this.logger.log(
        `Saga ${saga.sagaId} not in RESERVED state (${saga.status}); skipping release`,
      );
      return;
    }
    saga.status = SagaStatus.RELEASING;
    await this.sagaRepo.save(saga);
    await this.publisher.publishReleaseReservation({
      sagaId: saga.sagaId,
      osId: saga.osId,
      reservationId: saga.reservationId,
    });
    this.logger.log(`Saga ${saga.sagaId} → RELEASING`);
  }

  async handleReservationReleased(reply: ReservationReleasedReply): Promise<void> {
    const saga = await this.sagaRepo.findOne({ where: { sagaId: reply.sagaId } });
    if (!saga) {
      this.logger.warn(
        `Saga ${reply.sagaId} not found for reservation-released reply`,
      );
      return;
    }
    if (saga.status === SagaStatus.RELEASED) return;
    saga.status = SagaStatus.RELEASED;
    await this.sagaRepo.save(saga);
    this.logger.log(`Saga ${reply.sagaId} → RELEASED`);
  }

  private async findActiveByOrderId(
    orderId: string,
  ): Promise<SagaOrmEntity | null> {
    const candidates = await this.sagaRepo.find({
      where: { orderId, status: Not(SagaStatus.CONSUMED) },
      order: { createdAt: 'DESC' },
    });
    return (
      candidates.find((c) => !TERMINAL_STATUSES.includes(c.status)) ?? null
    );
  }
}
