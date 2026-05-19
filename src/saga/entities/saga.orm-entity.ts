import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from "typeorm";

import { SagaStatus } from "../enums/saga-status.enum";

export interface SagaItem {
  partId: string;
  quantity: number;
}

@Entity("saga_states")
export class SagaOrmEntity {
  @PrimaryColumn("uuid")
  id!: string;

  @Column({ name: "saga_id", type: "uuid", unique: true })
  sagaId!: string;

  @Index("idx_saga_order_id")
  @Column({ name: "order_id", type: "uuid" })
  orderId!: string;

  @Column({ name: "os_id", type: "varchar", length: 64 })
  osId!: string;

  @Column({
    name: "reservation_id",
    type: "varchar",
    length: 64,
    nullable: true,
  })
  reservationId!: string | null;

  @Column({ type: "varchar", length: 32 })
  status!: SagaStatus;

  @Column({ type: "jsonb" })
  items!: SagaItem[];

  @Column({ name: "failure_reason", type: "text", nullable: true })
  failureReason!: string | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
