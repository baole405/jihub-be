import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDocumentSubmissionReferenceOptional1765800000000 implements MigrationInterface {
  name = 'AddDocumentSubmissionReferenceOptional1765800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "DocumentSubmission"
      ADD COLUMN IF NOT EXISTS "reference" varchar(1000)
    `);

    await queryRunner.query(`
      ALTER TABLE "DocumentSubmission"
      ADD COLUMN IF NOT EXISTS "change_summary" text
    `);

    await queryRunner.query(`
      ALTER TABLE "DocumentSubmission"
      ALTER COLUMN "document_url" DROP NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "DocumentSubmission"
      SET "document_url" = ''
      WHERE "document_url" IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "DocumentSubmission"
      ALTER COLUMN "document_url" SET NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "DocumentSubmission"
      DROP COLUMN IF EXISTS "reference"
    `);

    await queryRunner.query(`
      ALTER TABLE "DocumentSubmission"
      DROP COLUMN IF EXISTS "change_summary"
    `);
  }
}
