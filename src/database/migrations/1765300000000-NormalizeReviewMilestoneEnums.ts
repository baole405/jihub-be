import { MigrationInterface, QueryRunner } from 'typeorm';

export class NormalizeReviewMilestoneEnums1765300000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'groupreview_milestone_code_enum') THEN
          ALTER TYPE "groupreview_milestone_code_enum" ADD VALUE IF NOT EXISTS 'FINAL_SCORE';
        END IF;

        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reviewsession_milestone_code_enum') THEN
          ALTER TYPE "reviewsession_milestone_code_enum" ADD VALUE IF NOT EXISTS 'FINAL_SCORE';
        END IF;
      END
      $$;
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL enum values cannot be safely removed without rebuilding the type.
    // This migration is intentionally irreversible.
  }
}
