# ADR-001 — Saga Pattern orquestrado (vs coreografado)

## Contexto

O fluxo `order.budget.approved → reserva estoque → executa → consume → paga`
envolve 4 serviços. Falha em qualquer ponto exige compensação (liberar
reserva, cancelar order).

Dois modelos disponíveis:

- **Coreografado** — cada serviço escuta eventos e age. Sem orquestrador.
- **Orquestrado** — um serviço central conhece o fluxo e dispara comandos.

## Decisão

**Orquestração** com um serviço dedicado: `autoflow-saga-orchestrator`.

**Por quê:**

1. **Visibilidade.** O estado da saga vive em uma tabela
   (`saga_states`) — qualquer query mostra em que ponto cada OS está. Em
   coreografia, o estado fica espalhado entre os serviços.

2. **Lógica de compensação local.** Se a reserva falha, o orquestrador sabe
   exatamente o que estava em curso e cancela a order. Em coreografia,
   o catalog precisaria conhecer order-service, gerando acoplamento.

3. **Debug.** Falhas no fluxo viram um log: "saga X parou no estado RESERVING".

4. **Justificativa acadêmica.** Tech-challenge pede a escolha documentada —
   orquestração é mais visível pedagogicamente.

## Consequências

**+** Estado centralizado, debugável.
**+** Mudança de fluxo afeta um único service.
**+** Compensação explícita e auditável.
**−** Single point of failure — se o orchestrator cair, sagas em curso
ficam paradas. Mitigado por: state em DB (recuperação no restart) +
idempotência (mensagens reprocessáveis).
**−** Acoplamento conhecido: orchestrator precisa conhecer routing keys de
todos os participantes. Aceitável vs ganho de visibilidade.
