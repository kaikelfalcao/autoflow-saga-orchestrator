# autoflow-saga-orchestrator

Microsserviço **orquestrador** do Saga Pattern do autoflow. Coordena o fluxo
transacional entre `order-service`, `catalog-service` e `payment-service`
mantendo o estado em `saga_states` (Postgres).

## O que ele faz

Não expõe API HTTP de negócio (só `/health`). Funciona inteiramente por
eventos RabbitMQ:

**Consome:**
- `order.events::order.budget.approved` → inicia saga
- `order.events::order.execution.completed` → solicita consumo
- `order.events::order.cancelled` → libera reserva
- `oficina.replies::stock.stock-reserved` → marca RESERVED
- `oficina.replies::stock.stock-insufficient` → cancela order (compensação)
- `oficina.replies::stock.stock-consumed` → marca CONSUMED
- `oficina.replies::stock.reservation-released` → marca RELEASED

**Publica:**
- `oficina.commands::stock.reserve-stock`
- `oficina.commands::stock.consume-stock`
- `oficina.commands::stock.release-reservation`

**Estados da saga:** `RESERVING → RESERVED → CONSUMING → CONSUMED`
(happy path) · `RESERVATION_FAILED` (estoque insuficiente) ·
`RELEASING → RELEASED` (cancelamento)

## Stack

- NestJS 11 + TypeScript
- Postgres 16 (TypeORM)
- RabbitMQ (`@golevelup/nestjs-rabbitmq`)
- Winston + New Relic APM

## Rodando localmente

Via cluster local:

```bash
cd ../autoflow-infra/local && ./reset.sh
```

Solo:

```bash
docker compose up -d postgres rabbitmq
npm install
npm run migration:run
npm run start:dev
```

Variáveis essenciais:

```
DATABASE_HOST, DATABASE_PORT, DATABASE_USER, DATABASE_PASSWORD, DATABASE_NAME
RABBITMQ_URL=amqp://admin:admin@localhost:5672
ORDER_SERVICE_URL=http://localhost:3001
```

## Como testar

```bash
npm run test            # unitários — 27 testes, ~98% coverage
npm run test:cov        # gate 80%
npm run test:bdd        # cucumber — happy path + compensação
```

## Documentação

- [docs/ADR-001-saga.md](docs/ADR-001-saga.md) — **escolha por orquestração** vs coreografia
- [docs/ADR-002-idempotencia.md](docs/ADR-002-idempotencia.md) — idempotência via sagaId único
- [docs/ADR-003-compensacao.md](docs/ADR-003-compensacao.md) — modelo de compensação
