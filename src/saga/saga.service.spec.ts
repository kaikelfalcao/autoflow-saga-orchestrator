import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';

import { OrderServiceClient } from './clients/order-service.client';
import { SagaOrmEntity } from './entities/saga.orm-entity';
import { SagaStatus } from './enums/saga-status.enum';
import { CatalogCommandsPublisher } from './messaging/catalog-commands.publisher';
import { SagaService } from './saga.service';

type Mock<T> = { [K in keyof T]: jest.Mock };

function makeSaga(partial: Partial<SagaOrmEntity> = {}): SagaOrmEntity {
  return {
    id: 'row-1',
    sagaId: 'saga-1',
    orderId: 'order-1',
    osId: 'order-1',
    items: [{ partId: 'p1', quantity: 2 }],
    status: SagaStatus.RESERVING,
    reservationId: null,
    failureReason: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...partial,
  } as SagaOrmEntity;
}

describe('SagaService', () => {
  let service: SagaService;
  let repo: Mock<Repository<SagaOrmEntity>>;
  let publisher: Mock<CatalogCommandsPublisher>;
  let orderClient: Mock<OrderServiceClient>;

  beforeEach(async () => {
    repo = {
      create: jest.fn((data) => data as SagaOrmEntity),
      save: jest.fn(async (e: SagaOrmEntity) => e),
      findOne: jest.fn(),
      find: jest.fn(async () => []),
    } as unknown as Mock<Repository<SagaOrmEntity>>;

    publisher = {
      publishReserveStock: jest.fn(async () => undefined),
      publishConsumeStock: jest.fn(async () => undefined),
      publishReleaseReservation: jest.fn(async () => undefined),
    } as unknown as Mock<CatalogCommandsPublisher>;

    orderClient = {
      getOrder: jest.fn(),
      cancelOrder: jest.fn(async () => undefined),
    } as unknown as Mock<OrderServiceClient>;

    const moduleRef = await Test.createTestingModule({
      providers: [
        SagaService,
        { provide: getRepositoryToken(SagaOrmEntity), useValue: repo },
        { provide: CatalogCommandsPublisher, useValue: publisher },
        { provide: OrderServiceClient, useValue: orderClient },
      ],
    }).compile();

    service = moduleRef.get(SagaService);
  });

  describe('handleBudgetApproved', () => {
    it('cria saga e publica reserve-stock quando há items PART', async () => {
      repo.find.mockResolvedValue([]);
      orderClient.getOrder.mockResolvedValue({
        id: 'order-1',
        status: 'IN_EXECUTION',
        items: [
          { catalogItemId: 'p1', itemType: 'PART', quantity: 2 },
          { catalogItemId: 's1', itemType: 'SERVICE', quantity: 1 },
        ],
      });

      await service.handleBudgetApproved('order-1');

      expect(repo.save).toHaveBeenCalledTimes(1);
      expect(publisher.publishReserveStock).toHaveBeenCalledWith(
        expect.objectContaining({
          osId: 'order-1',
          items: [{ partId: 'p1', quantity: 2 }],
        }),
      );
    });

    it('não cria saga quando order não tem items PART', async () => {
      repo.find.mockResolvedValue([]);
      orderClient.getOrder.mockResolvedValue({
        id: 'order-1',
        status: 'IN_EXECUTION',
        items: [{ catalogItemId: 's1', itemType: 'SERVICE', quantity: 1 }],
      });

      await service.handleBudgetApproved('order-1');

      expect(repo.save).not.toHaveBeenCalled();
      expect(publisher.publishReserveStock).not.toHaveBeenCalled();
    });

    it('é idempotente — não recria saga quando já existe ativa', async () => {
      repo.find.mockResolvedValue([makeSaga({ status: SagaStatus.RESERVING })]);

      await service.handleBudgetApproved('order-1');

      expect(orderClient.getOrder).not.toHaveBeenCalled();
      expect(publisher.publishReserveStock).not.toHaveBeenCalled();
    });
  });

  describe('handleStockReserved', () => {
    it('marca saga como RESERVED e guarda reservationId', async () => {
      repo.findOne.mockResolvedValue(makeSaga({ status: SagaStatus.RESERVING }));

      await service.handleStockReserved({
        sagaId: 'saga-1',
        osId: 'order-1',
        reservationId: 'res-1',
      });

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: SagaStatus.RESERVED,
          reservationId: 'res-1',
        }),
      );
    });

    it('ignora quando saga não existe', async () => {
      repo.findOne.mockResolvedValue(null);
      await service.handleStockReserved({
        sagaId: 'x',
        osId: 'y',
        reservationId: 'r',
      });
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('é idempotente — não reprocessa se já RESERVED', async () => {
      repo.findOne.mockResolvedValue(makeSaga({ status: SagaStatus.RESERVED }));
      await service.handleStockReserved({
        sagaId: 'saga-1',
        osId: 'order-1',
        reservationId: 'res-1',
      });
      expect(repo.save).not.toHaveBeenCalled();
    });
  });

  describe('handleStockInsufficient', () => {
    it('marca RESERVATION_FAILED e cancela a order', async () => {
      repo.findOne.mockResolvedValue(makeSaga({ status: SagaStatus.RESERVING }));

      await service.handleStockInsufficient({
        sagaId: 'saga-1',
        osId: 'order-1',
        failures: [{ partId: 'p1', requested: 10, available: 5 }],
      });

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: SagaStatus.RESERVATION_FAILED }),
      );
      expect(orderClient.cancelOrder).toHaveBeenCalledWith(
        'order-1',
        expect.stringContaining('partId=p1'),
      );
    });

    it('engole 400 do order-service (order já em estado terminal)', async () => {
      repo.findOne.mockResolvedValue(makeSaga({ status: SagaStatus.RESERVING }));
      orderClient.cancelOrder.mockRejectedValue({ response: { status: 400 } });

      await expect(
        service.handleStockInsufficient({
          sagaId: 'saga-1',
          osId: 'order-1',
          failures: [{ partId: 'p1', requested: 3, available: 0 }],
        }),
      ).resolves.not.toThrow();
    });

    it('repropaga erro != 400 do order-service', async () => {
      repo.findOne.mockResolvedValue(makeSaga({ status: SagaStatus.RESERVING }));
      orderClient.cancelOrder.mockRejectedValue({ response: { status: 500 } });

      await expect(
        service.handleStockInsufficient({
          sagaId: 'saga-1',
          osId: 'order-1',
          failures: [{ partId: 'p1', requested: 3, available: 0 }],
        }),
      ).rejects.toBeDefined();
    });

    it('ignora quando saga já em RESERVATION_FAILED', async () => {
      repo.findOne.mockResolvedValue(
        makeSaga({ status: SagaStatus.RESERVATION_FAILED }),
      );
      await service.handleStockInsufficient({
        sagaId: 'saga-1',
        osId: 'order-1',
        failures: [],
      });
      expect(orderClient.cancelOrder).not.toHaveBeenCalled();
    });
  });

  describe('handleExecutionCompleted', () => {
    it('avança saga RESERVED → CONSUMING e publica consume', async () => {
      repo.find.mockResolvedValue([
        makeSaga({ status: SagaStatus.RESERVED, reservationId: 'res-1' }),
      ]);

      await service.handleExecutionCompleted('order-1');

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: SagaStatus.CONSUMING }),
      );
      expect(publisher.publishConsumeStock).toHaveBeenCalledWith(
        expect.objectContaining({ reservationId: 'res-1' }),
      );
    });

    it('ignora quando saga não está em RESERVED', async () => {
      repo.find.mockResolvedValue([
        makeSaga({ status: SagaStatus.RESERVING, reservationId: null }),
      ]);
      await service.handleExecutionCompleted('order-1');
      expect(publisher.publishConsumeStock).not.toHaveBeenCalled();
    });

    it('ignora quando não há saga para a order', async () => {
      repo.find.mockResolvedValue([]);
      await service.handleExecutionCompleted('order-1');
      expect(publisher.publishConsumeStock).not.toHaveBeenCalled();
    });
  });

  describe('handleStockConsumed', () => {
    it('marca saga como CONSUMED', async () => {
      repo.findOne.mockResolvedValue(makeSaga({ status: SagaStatus.CONSUMING }));
      await service.handleStockConsumed({
        sagaId: 'saga-1',
        osId: 'order-1',
        reservationId: 'res-1',
      });
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: SagaStatus.CONSUMED }),
      );
    });

    it('ignora quando saga não existe', async () => {
      repo.findOne.mockResolvedValue(null);
      await service.handleStockConsumed({
        sagaId: 'x',
        osId: 'y',
        reservationId: 'r',
      });
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('é idempotente — pula se já CONSUMED', async () => {
      repo.findOne.mockResolvedValue(makeSaga({ status: SagaStatus.CONSUMED }));
      await service.handleStockConsumed({
        sagaId: 'saga-1',
        osId: 'order-1',
        reservationId: 'res-1',
      });
      expect(repo.save).not.toHaveBeenCalled();
    });
  });

  describe('handleOrderCancelled', () => {
    it('libera reserva quando saga estava RESERVED', async () => {
      repo.find.mockResolvedValue([
        makeSaga({ status: SagaStatus.RESERVED, reservationId: 'res-1' }),
      ]);

      await service.handleOrderCancelled('order-1');

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: SagaStatus.RELEASING }),
      );
      expect(publisher.publishReleaseReservation).toHaveBeenCalledWith(
        expect.objectContaining({ reservationId: 'res-1' }),
      );
    });

    it('não faz nada quando saga não está em RESERVED', async () => {
      repo.find.mockResolvedValue([
        makeSaga({ status: SagaStatus.CONSUMING, reservationId: 'res-1' }),
      ]);
      await service.handleOrderCancelled('order-1');
      expect(publisher.publishReleaseReservation).not.toHaveBeenCalled();
    });

    it('não faz nada quando não há saga', async () => {
      repo.find.mockResolvedValue([]);
      await service.handleOrderCancelled('order-1');
      expect(publisher.publishReleaseReservation).not.toHaveBeenCalled();
    });
  });

  describe('handleReservationReleased', () => {
    it('marca saga como RELEASED', async () => {
      repo.findOne.mockResolvedValue(makeSaga({ status: SagaStatus.RELEASING }));
      await service.handleReservationReleased({
        sagaId: 'saga-1',
        osId: 'order-1',
        reservationId: 'res-1',
      });
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: SagaStatus.RELEASED }),
      );
    });

    it('ignora quando saga não existe', async () => {
      repo.findOne.mockResolvedValue(null);
      await service.handleReservationReleased({
        sagaId: 'x',
        osId: 'y',
        reservationId: 'r',
      });
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('é idempotente — pula se já RELEASED', async () => {
      repo.findOne.mockResolvedValue(makeSaga({ status: SagaStatus.RELEASED }));
      await service.handleReservationReleased({
        sagaId: 'saga-1',
        osId: 'order-1',
        reservationId: 'res-1',
      });
      expect(repo.save).not.toHaveBeenCalled();
    });
  });
});
