import { setWorldConstructor, World } from '@cucumber/cucumber';
import type { Repository } from 'typeorm';

import { OrderServiceClient } from '../../src/saga/clients/order-service.client';
import type { SagaOrmEntity, SagaItem } from '../../src/saga/entities/saga.orm-entity';
import { SagaStatus } from '../../src/saga/enums/saga-status.enum';
import { CatalogCommandsPublisher } from '../../src/saga/messaging/catalog-commands.publisher';
import { SagaService } from '../../src/saga/saga.service';

interface PublishedReserve {
  sagaId: string;
  osId: string;
  items: SagaItem[];
}

class InMemorySagaRepo {
  private rows: SagaOrmEntity[] = [];

  create(data: Partial<SagaOrmEntity>): SagaOrmEntity {
    return data as SagaOrmEntity;
  }

  async save(e: SagaOrmEntity): Promise<SagaOrmEntity> {
    const idx = this.rows.findIndex((r) => r.id === e.id);
    if (idx >= 0) this.rows[idx] = e;
    else this.rows.push(e);
    return e;
  }

  async findOne(opts: { where: { sagaId: string } }): Promise<SagaOrmEntity | null> {
    return this.rows.find((r) => r.sagaId === opts.where.sagaId) ?? null;
  }

  async find(opts: { where: { orderId: string } }): Promise<SagaOrmEntity[]> {
    return this.rows.filter((r) => r.orderId === opts.where.orderId);
  }

  byOrder(orderId: string): SagaOrmEntity | undefined {
    return [...this.rows]
      .reverse()
      .find((r) => r.orderId === orderId);
  }
}

class CapturingPublisher {
  reserveCalls: PublishedReserve[] = [];
  consumeCalls: Array<{ sagaId: string; reservationId: string }> = [];
  releaseCalls: Array<{ sagaId: string; reservationId: string }> = [];

  async publishReserveStock(p: PublishedReserve): Promise<void> {
    this.reserveCalls.push(p);
  }
  async publishConsumeStock(p: { sagaId: string; osId: string; reservationId: string }): Promise<void> {
    this.consumeCalls.push({ sagaId: p.sagaId, reservationId: p.reservationId });
  }
  async publishReleaseReservation(p: { sagaId: string; osId: string; reservationId: string }): Promise<void> {
    this.releaseCalls.push({ sagaId: p.sagaId, reservationId: p.reservationId });
  }
}

class CapturingOrderClient {
  cancelCalls: Array<{ orderId: string; reason: string }> = [];
  orderItems: Record<string, Array<{ partId: string; quantity: number }>> = {};

  async getOrder(orderId: string) {
    return {
      id: orderId,
      status: 'IN_EXECUTION',
      items: (this.orderItems[orderId] ?? []).map((i) => ({
        catalogItemId: i.partId,
        itemType: 'PART' as const,
        quantity: i.quantity,
      })),
    };
  }

  async cancelOrder(orderId: string, reason: string): Promise<void> {
    this.cancelCalls.push({ orderId, reason });
  }
}

export class SagaWorld extends World {
  repo = new InMemorySagaRepo();
  publisher = new CapturingPublisher();
  orderClient = new CapturingOrderClient();
  service: SagaService;

  constructor(options: ConstructorParameters<typeof World>[0]) {
    super(options);
    this.service = new SagaService(
      this.repo as unknown as Repository<SagaOrmEntity>,
      this.publisher as unknown as CatalogCommandsPublisher,
      this.orderClient as unknown as OrderServiceClient,
    );
  }

  expectStatus(orderId: string, status: SagaStatus): void {
    const saga = this.repo.byOrder(orderId);
    if (!saga) {
      throw new Error(`No saga for ${orderId}`);
    }
    if (saga.status !== status) {
      throw new Error(`Expected ${orderId} status ${status}, got ${saga.status}`);
    }
  }
}

setWorldConstructor(SagaWorld);
