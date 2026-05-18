# ADR-002 — Idempotência via sagaId único

## Contexto

RabbitMQ entrega *at-least-once*. Qualquer handler pode receber a mesma
mensagem duas vezes (reentrega após Nack/disconnect). Sem proteção, o saga
iniciaria duas vezes, reservaria estoque em dobro etc.

## Decisão

- Cada saga tem um `sagaId` UUID gerado no início (`handleBudgetApproved`)
- Coluna `saga_id` em `saga_states` é **UNIQUE**
- Antes de iniciar saga, `findActiveByOrderId` checa se já existe ativa
- Replies (`stock-reserved`, `stock-consumed`) usam `sagaId` para localizar
  a row; se status já é o esperado, faz no-op:

  ```ts
  if (saga.status === SagaStatus.RESERVED) return;
  ```

## Consequências

**+** Reprocessar a mesma mensagem é seguro — vira no-op.
**+** UNIQUE garante consistência sob race condition (2 instâncias do
orchestrator processando ao mesmo tempo).
**−** Cada handler tem o boilerplate de checar status. Aceitável.
