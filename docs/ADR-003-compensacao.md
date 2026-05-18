# ADR-003 — Compensação explícita por estado

## Contexto

Quando a reserva falha (`stock-insufficient`), o orchestrator precisa:
1. Marcar a saga como falha.
2. Cancelar a order para o cliente saber.
3. Não tentar consumir estoque depois.

Quando a order é cancelada (manual), o orchestrator precisa liberar a
reserva (se já tinha sido feita).

## Decisão

Compensação por **estado-alvo**, não por "rollback genérico":

- `handleStockInsufficient` → `RESERVATION_FAILED` + chama
  `cancelOrder()` via HTTP no order-service
- `handleOrderCancelled` → se status é `RESERVED`, publica
  `stock.release-reservation` e vai para `RELEASING`
- `handleReservationReleased` → `RELEASED`

Se o `cancelOrder` HTTP devolver 400 (order já estava em estado terminal),
engolimos o erro — não é falha real. Outros HTTP errors propagam.

## Consequências

**+** Cada compensação é uma transição clara, não há "undo" mágico.
**+** Estado intermediário `RELEASING` evita reentrega causar
double-release.
**−** Cancelar via HTTP acopla saga ao order-service. Alternativa
considerada (publicar evento `saga.compensation.needed` para order
consumir) descartada porque o cancelamento da order tem outras regras
(state machine) que valem por si.
