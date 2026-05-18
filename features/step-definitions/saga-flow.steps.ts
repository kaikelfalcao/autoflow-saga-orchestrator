import { Given, Then, When } from '@cucumber/cucumber';
import { strict as assert } from 'node:assert';

import { SagaStatus } from '../../src/saga/enums/saga-status.enum';
import type { SagaWorld } from '../support/world';

Given('a saga-orchestrator está iniciada', function (this: SagaWorld) {
  assert.ok(this.service);
});

Given(
  /^a order "([^"]+)" tem (\d+) peças PART id "([^"]+)"$/,
  function (this: SagaWorld, orderId: string, qty: string, partId: string) {
    this.orderClient.orderItems[orderId] = [
      { partId, quantity: Number(qty) },
    ];
  },
);

When(
  /^o evento order.budget.approved chega para "([^"]+)"$/,
  async function (this: SagaWorld, orderId: string) {
    await this.service.handleBudgetApproved(orderId);
  },
);

Then(
  /^o comando stock.reserve-stock é publicado para "([^"]+)"$/,
  function (this: SagaWorld, orderId: string) {
    const call = this.publisher.reserveCalls.find((c) => c.osId === orderId);
    assert.ok(call, `Expected reserve-stock for ${orderId}`);
  },
);

Then(
  /^a saga de "([^"]+)" fica em status "([^"]+)"$/,
  function (this: SagaWorld, orderId: string, status: string) {
    this.expectStatus(orderId, status as SagaStatus);
  },
);

When(
  /^o reply stock.stock-reserved chega com reservationId "([^"]+)"$/,
  async function (this: SagaWorld, reservationId: string) {
    const lastReserve =
      this.publisher.reserveCalls[this.publisher.reserveCalls.length - 1];
    assert.ok(lastReserve, 'no reserve call captured');
    await this.service.handleStockReserved({
      sagaId: lastReserve.sagaId,
      osId: lastReserve.osId,
      reservationId,
    });
  },
);

When(
  /^o evento order.execution.completed chega para "([^"]+)"$/,
  async function (this: SagaWorld, orderId: string) {
    await this.service.handleExecutionCompleted(orderId);
  },
);

Then(
  /^o comando stock.consume-stock é publicado com reservationId "([^"]+)"$/,
  function (this: SagaWorld, reservationId: string) {
    const found = this.publisher.consumeCalls.find(
      (c) => c.reservationId === reservationId,
    );
    assert.ok(found, `Expected consume-stock for ${reservationId}`);
  },
);

When(
  /^o reply stock.stock-consumed chega$/,
  async function (this: SagaWorld) {
    const lastConsume =
      this.publisher.consumeCalls[this.publisher.consumeCalls.length - 1];
    assert.ok(lastConsume);
    await this.service.handleStockConsumed({
      sagaId: lastConsume.sagaId,
      osId: '',
      reservationId: lastConsume.reservationId,
    });
  },
);

When(
  /^o reply stock.stock-insufficient chega para "([^"]+)" reportando "([^"]+)" com disponível (\d+)$/,
  async function (
    this: SagaWorld,
    orderId: string,
    partId: string,
    available: string,
  ) {
    const lastReserve = this.publisher.reserveCalls.find(
      (c) => c.osId === orderId,
    );
    assert.ok(lastReserve, `no reserve call for ${orderId}`);
    await this.service.handleStockInsufficient({
      sagaId: lastReserve.sagaId,
      osId: orderId,
      failures: [
        { partId, requested: lastReserve.items[0].quantity, available: Number(available) },
      ],
    });
  },
);

Then(
  /^a order "([^"]+)" recebeu chamada de cancelamento$/,
  function (this: SagaWorld, orderId: string) {
    const found = this.orderClient.cancelCalls.find(
      (c) => c.orderId === orderId,
    );
    assert.ok(found, `Expected cancel for ${orderId}`);
  },
);
