import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddJiraSyncStateToTask1761300000000 implements MigrationInterface {
  name = 'AddJiraSyncStateToTask1761300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "public"."Task_jira_sync_status_enum" AS ENUM('SUCCESS', 'FAILED', 'SKIPPED')
    `);
    await queryRunner.query(`
      ALTER TABLE "Task"
      ADD COLUMN "jira_sync_status" "public"."Task_jira_sync_status_enum" NOT NULL DEFAULT 'SKIPPED'
    `);
    await queryRunner.query(`
      ALTER TABLE "Task"
      ADD COLUMN "jira_sync_reason" character varying(100)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "Task"
      DROP COLUMN "jira_sync_reason"
    `);
    await queryRunner.query(`
      ALTER TABLE "Task"
      DROP COLUMN "jira_sync_status"
    `);
    await queryRunner.query(`
      DROP TYPE "public"."Task_jira_sync_status_enum"
    `);
  }
}
