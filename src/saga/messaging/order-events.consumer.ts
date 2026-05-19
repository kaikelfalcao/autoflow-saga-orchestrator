import { Nack, RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import { Injectable, Logger } from "@nestjs/common";

import { SagaService } from "../saga.service";

interface BaseEvent<T> {
  eventId?: string;
  eventType?: string;
  correlationId?: string;
  payload: T;
}

interface BudgetApprovedPayload {
  orderId: string;
  totalAmount?: number;
  approvedAt?: string;
}

interface ExecutionCompletedPayload {
  orderId: string;
  customerCpf?: string;
  completedAt?: string;
}

interface OrderCancelledPayload {
  orderId: string;
  reason?: string;
  cancelledAt?: string;
}

@Injectable()
export class OrderEventsConsumer {
  private readonly logger = new Logger(OrderEventsConsumer.name);

  constructor(private readonly sagaService: SagaService) {}

  @RabbitSubscribe({
    exchange: "order.events",
    routingKey: "order.budget.approved",
    queue: "saga.order.budget-approved",
    queueOptions: { durable: true },
  })
  async onBudgetApproved(
    msg: BaseEvent<BudgetApprovedPayload>,
  ): Promise<Nack | void> {
    try {
      await this.sagaService.handleBudgetApproved(msg.payload.orderId);
    } catch (err) {
      this.logger.error(
        `Failed order.budget.approved: ${(err as Error).message}`,
        (err as Error).stack,
      );
      return new Nack(false);
    }
  }

  @RabbitSubscribe({
    exchange: "order.events",
    routingKey: "order.execution.completed",
    queue: "saga.order.execution-completed",
    queueOptions: { durable: true },
  })
  async onExecutionCompleted(
    msg: BaseEvent<ExecutionCompletedPayload>,
  ): Promise<Nack | void> {
    try {
      await this.sagaService.handleExecutionCompleted(msg.payload.orderId);
    } catch (err) {
      this.logger.error(
        `Failed order.execution.completed: ${(err as Error).message}`,
        (err as Error).stack,
      );
      return new Nack(false);
    }
  }

  @RabbitSubscribe({
    exchange: "order.events",
    routingKey: "order.cancelled",
    queue: "saga.order.cancelled",
    queueOptions: { durable: true },
  })
  async onOrderCancelled(
    msg: BaseEvent<OrderCancelledPayload>,
  ): Promise<Nack | void> {
    try {
      await this.sagaService.handleOrderCancelled(msg.payload.orderId);
    } catch (err) {
      this.logger.error(
        `Failed order.cancelled: ${(err as Error).message}`,
        (err as Error).stack,
      );
      return new Nack(false);
    }
  }
}
