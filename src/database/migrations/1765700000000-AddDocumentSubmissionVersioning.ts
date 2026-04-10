import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDocumentSubmissionVersioning1765700000000 implements MigrationInterface {
  name = 'AddDocumentSubmissionVersioning1765700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "DocumentSubmission"
      ADD COLUMN IF NOT EXISTS "base_submission_id" uuid
    `);

    await queryRunner.query(`
      ALTER TABLE "DocumentSubmission"
      ADD COLUMN IF NOT EXISTS "version_number" integer NOT NULL DEFAULT 1
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_type t
          JOIN pg_enum e ON t.oid = e.enumtypid
          WHERE t.typname = 'DocumentSubmission_status_enum'
            AND e.enumlabel = 'DRAFT'
        ) THEN
          ALTER TYPE "DocumentSubmission_status_enum" ADD VALUE 'DRAFT';
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'FK_document_submission_base_submission'
        ) THEN
          ALTER TABLE "DocumentSubmission"
          ADD CONSTRAINT "FK_document_submission_base_submission"
          FOREIGN KEY ("base_submission_id")
          REFERENCES "DocumentSubmission"("id")
          ON DELETE SET NULL;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_document_submission_group_version"
      ON "DocumentSubmission" ("group_id", "version_number")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_document_submission_group_version"
    `);

    await queryRunner.query(`
      ALTER TABLE "DocumentSubmission"
      DROP CONSTRAINT IF EXISTS "FK_document_submission_base_submission"
    `);

    await queryRunner.query(`
      ALTER TABLE "DocumentSubmission"
      DROP COLUMN IF EXISTS "base_submission_id"
    `);

    await queryRunner.query(`
      ALTER TABLE "DocumentSubmission"
      DROP COLUMN IF EXISTS "version_number"
    `);
  }
}
