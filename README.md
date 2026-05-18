# autoflow-saga-orchestrator

> **Orquestrador do Saga Pattern** do ecossistema **autoflow** (FIAP Tech Challenge — Fase 4).

Coordena a reserva/consumo/liberação de estoque entre o `order-service` e o `catalog-service`. Não expõe REST além de `/health` — sua interface é puramente assíncrona via RabbitMQ + chamadas HTTP para o `order-service` (cancelar OS quando saga falha).

---

## 🧱 Stack

| Camada       | Tecnologia                                |
|--------------|-------------------------------------------|
| Runtime      | Node.js 24 (LTS)                          |
| Linguagem    | TypeScript (strict)                       |
| Framework    | NestJS 11                                 |
| Banco        | PostgreSQL 16 (TypeORM + migrations)      |
| Mensageria   | RabbitMQ (`@golevelup/nestjs-rabbitmq`)   |
| HTTP client  | `@nestjs/axios` → order-service           |
| Observ.      | New Relic APM + canonical logs (Winston)  |
| Testes       | Jest + Cucumber (BDD)                     |
| Container    | Docker multi-stage                        |
| Deploy       | EKS via GitHub Actions                    |

Lint via `tsc --noEmit`.

---

## 🏛️ Arquitetura

Estrutura **flat**, todo o domínio da saga concentrado em `src/saga/`:

```
src/
├── saga/
│   ├── saga.module.ts
│   ├── saga.service.ts        ← orquestração (state transitions + persistência)
│   ├── entities/
│   │   └── saga.orm-entity.ts ← SagaOrmEntity (TypeORM) com items + status + sagaId único
│   ├── enums/
│   │   └── saga-status.enum.ts
│   ├── clients/
│   │   └── order-service.client.ts  ← HTTP client (cancel OS)
│   └── messaging/
│       ├── order-events.consumer.ts      ← consome order.events
│       ├── catalog-replies.consumer.ts   ← consome oficina.replies
│       └── catalog-commands.publisher.ts ← publica em oficina.commands
├── database/
│   ├── migrations/
│   └── (datasource)
├── messaging/
│   └── rabbitmq.module.ts     ← config do exchange/connection
├── health/
└── shared/                    ← logger, middlewares, observability
```

---

## 🔄 Máquina de estados

```
       order.budget.approved
              │
              ▼
        ┌──STARTED──┐
        │           │
        ▼           │
   RESERVING ──→ stock.reserve-stock (publica)
        │
        ├── stock.stock-reserved      ──→ RESERVED
        │                                  │
        │                                  ▼
        │   (order.execution.completed)  CONSUMING ──→ stock.consume-stock
        │                                  │
        │                                  ├── stock.stock-consumed ──→ CONSUMED  ✓
        │                                  └── (timeout/erro)       ──→ FAILED   ✗
        │
        └── stock.stock-insufficient   ──→ RESERVATION_FAILED        ✗
                                              │
                                              └─ HTTP PATCH /orders/:id/cancel
```

Compensação (cancelar OS em execução):

```
order.cancelled  ──→ RELEASING ──→ stock.release-reservation
                                          │
                                          └── stock.reservation-released ──→ RELEASED  ✓
```

Estados terminais: `CONSUMED`, `RELEASED`, `FAILED`, `RESERVATION_FAILED`.

**Idempotência:** índice único em `sagaId`. Eventos reentregues pelo RMQ (at-least-once) são deduzidos no `saga.service.ts` antes de avançar o estado.

---

## 📬 Eventos RabbitMQ

### Consumidos — `order.events` (topic)
| Routing key                   | Ação na saga                          |
|-------------------------------|---------------------------------------|
| `order.budget.approved`       | Inicia saga (RESERVING)               |
| `order.execution.completed`   | Avança para CONSUMING                 |
| `order.cancelled`             | Compensação (RELEASING)               |

### Consumidos — `oficina.replies` (topic)
| Routing key                   | Ação na saga                          |
|-------------------------------|---------------------------------------|
| `stock.stock-reserved`        | RESERVING → RESERVED                  |
| `stock.stock-insufficient`    | RESERVING → RESERVATION_FAILED + cancela OS |
| `stock.stock-consumed`        | CONSUMING → CONSUMED                  |
| `stock.reservation-released`  | RELEASING → RELEASED                  |

### Publicados — `oficina.commands` (topic)
| Routing key                   | Destinatário                          |
|-------------------------------|---------------------------------------|
| `stock.reserve-stock`         | catalog-service                       |
| `stock.consume-stock`         | catalog-service                       |
| `stock.release-reservation`   | catalog-service                       |

Envelope canônico: `{ sagaId, correlationId, eventId, occurredAt, payload }`.

---

## 🔧 Variáveis de ambiente

| Variável              | Default                                     | Descrição              |
|-----------------------|---------------------------------------------|------------------------|
| `PORT`                | `3002`                                      | porta HTTP (health)    |
| `DATABASE_HOST`       | `localhost`                                 |                        |
| `DATABASE_PORT`       | `5432`                                      |                        |
| `DATABASE_USER`       | `saga_user`                                 |                        |
| `DATABASE_PASSWORD`   | —                                           |                        |
| `DATABASE_NAME`       | `saga`                                      |                        |
| `RABBITMQ_URL`        | `amqp://admin:admin@localhost:5672`         |                        |
| `ORDER_SERVICE_URL`   | `http://localhost:3001`                     | para `PATCH /orders/:id/cancel` |
| `NEW_RELIC_LICENSE_KEY` | —                                         | (opcional) APM         |

---

## 🚀 Rodar localmente

```bash
npm install
# Postgres + RabbitMQ via docker-compose externo (ou via autoflow-infra/local)
npm run migration:run
npm run start:dev
```

Integração completa: `cd ../autoflow-infra/local && ./bootstrap.sh`.

---

## 🧪 Testes

```bash
npm run test           # unit
npm run test:cov       # threshold 80% global
npm run test:bdd       # Cucumber
npm run lint           # tsc --noEmit
```

Coverage atual: 100% nos `saga.service` e nos consumers monitorados.

> **TODO:** SonarQube Community.

---

## 🐳 Docker / ☸️ Deploy

| Workflow | Trigger                          | Jobs                              |
|----------|----------------------------------|-----------------------------------|
| `ci.yml` | push/PR em qualquer branch       | lint + test:cov + bdd             |
| `cd.yml` | `workflow_run` (CI ok em `main`) | DockerHub + EKS rollout           |

Imagem: `kaikelfalcao/autoflow-saga:<sha>`. Cluster `autoflow-dev-eks` / namespace `autoflow`.

---

## 📊 Observabilidade

- Logs canônicos por evento processado, incluindo `sagaId`, `orderId`, `oldStatus`, `newStatus`.
- Custom event `SagaCompensation` no New Relic quando uma compensação é disparada.
- Falhas terminais (`FAILED`, `RESERVATION_FAILED`) acionam HTTP PATCH para cancelar a OS no order-service.

---

## 🔗 Ecossistema

[`autoflow-infra`](https://github.com/kaikelfalcao/autoflow-infra) · [`autoflow-identity-service`](https://github.com/kaikelfalcao/autoflow-identity-service) · [`autoflow-order-service`](https://github.com/kaikelfalcao/autoflow-order-service) · [`autoflow-catalog-service`](https://github.com/kaikelfalcao/autoflow-catalog-service) · [`autoflow-payment-service`](https://github.com/kaikelfalcao/autoflow-payment-service) · [`autoflow-notification-service`](https://github.com/kaikelfalcao/autoflow-notification-service)
