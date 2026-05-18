import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSagas1714000000001 implements MigrationInterface {
  name = 'CreateSagas1714000000001';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS saga_states (
        id              UUID PRIMARY KEY,
        saga_id         UUID NOT NULL,
        order_id        UUID NOT NULL,
        os_id           VARCHAR(64) NOT NULL,
        reservation_id  VARCHAR(64),
        status          VARCHAR(32) NOT NULL,
        items           JSONB NOT NULL,
        failure_reason  TEXT,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT saga_states_saga_id_unique UNIQUE (saga_id)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX idx_saga_order_id ON saga_states (order_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_saga_status ON saga_states (status)`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_saga_status`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_saga_order_id`);
    await queryRunner.query(`DROP TABLE IF EXISTS saga_states`);
  }
}
