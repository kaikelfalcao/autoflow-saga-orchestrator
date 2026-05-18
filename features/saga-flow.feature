Feature: Saga de estoque — happy path e compensação
  Como saga-orchestrator
  Quero coordenar reserva, consumo e liberação de estoque
  Para garantir consistência entre ordens de serviço e catálogo

  Background:
    Given a saga-orchestrator está iniciada

  Scenario: Happy path — reserva, consome e finaliza
    Given a order "order-1" tem 2 peças PART id "p1"
    When o evento order.budget.approved chega para "order-1"
    Then o comando stock.reserve-stock é publicado para "order-1"
    And a saga de "order-1" fica em status "RESERVING"
    When o reply stock.stock-reserved chega com reservationId "res-1"
    Then a saga de "order-1" fica em status "RESERVED"
    When o evento order.execution.completed chega para "order-1"
    Then o comando stock.consume-stock é publicado com reservationId "res-1"
    And a saga de "order-1" fica em status "CONSUMING"
    When o reply stock.stock-consumed chega
    Then a saga de "order-1" fica em status "CONSUMED"

  Scenario: Compensação — estoque insuficiente cancela a order
    Given a order "order-2" tem 10 peças PART id "p99"
    When o evento order.budget.approved chega para "order-2"
    And o reply stock.stock-insufficient chega para "order-2" reportando "p99" com disponível 0
    Then a saga de "order-2" fica em status "RESERVATION_FAILED"
    And a order "order-2" recebeu chamada de cancelamento
