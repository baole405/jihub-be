import { MigrationInterface, QueryRunner } from 'typeorm';

export class ExpandReviewSessionAndScoring1765400000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reviewsessionauditlog_action_enum') THEN
          CREATE TYPE "reviewsessionauditlog_action_enum" AS ENUM ('CREATED', 'UPDATED', 'DELETED');
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'groupreview_scoring_formula_enum') THEN
          CREATE TYPE "groupreview_scoring_formula_enum" AS ENUM (
            'ATTENDANCE_ONLY',
            'PROBLEM_RESOLUTION_CONTRIBUTION',
            'ATTENDANCE_PROBLEM_CONTRIBUTION',
            'CUSTOM_SELECTION'
          );
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "ReviewSession"
      ADD COLUMN IF NOT EXISTS "review_day" date,
      ADD COLUMN IF NOT EXISTS "what_done_since_last_review" text,
      ADD COLUMN IF NOT EXISTS "next_plan_until_next_review" text,
      ADD COLUMN IF NOT EXISTS "previous_problem_followup" text,
      ADD COLUMN IF NOT EXISTS "current_problems" jsonb NOT NULL DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS "attendance_ratio" numeric(5,2),
      ADD COLUMN IF NOT EXISTS "deleted_at" timestamptz
    `);

    await queryRunner.query(`
      UPDATE "ReviewSession"
      SET "review_day" = ("review_date" AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
      WHERE "review_day" IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "ReviewSession"
      ALTER COLUMN "review_day" SET NOT NULL
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_review_session_group_day_active"
      ON "ReviewSession" ("group_id", "review_day")
      WHERE "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "GroupReview"
      ADD COLUMN IF NOT EXISTS "auto_score" numeric(5,2),
      ADD COLUMN IF NOT EXISTS "final_score" numeric(5,2),
      ADD COLUMN IF NOT EXISTS "override_reason" text,
      ADD COLUMN IF NOT EXISTS "scoring_formula" groupreview_scoring_formula_enum,
      ADD COLUMN IF NOT EXISTS "scoring_config_snapshot" jsonb,
      ADD COLUMN IF NOT EXISTS "metric_total_problems" int NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "metric_resolved_ratio" numeric(5,2),
      ADD COLUMN IF NOT EXISTS "metric_overdue_task_ratio" numeric(5,2),
      ADD COLUMN IF NOT EXISTS "metric_attendance_ratio" numeric(5,2)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "ReviewSessionAuditLog" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "review_session_id" uuid NULL,
        "semester_id" uuid NOT NULL,
        "group_id" uuid NOT NULL,
        "milestone_code" reviewsession_milestone_code_enum NOT NULL,
        "action" reviewsessionauditlog_action_enum NOT NULL,
        "version_number" int NOT NULL,
        "actor_user_id" uuid NULL,
        "snapshot" jsonb NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_review_session_audit_group"
      ON "ReviewSessionAuditLog" ("group_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_review_session_audit_semester"
      ON "ReviewSessionAuditLog" ("semester_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_review_session_audit_review_session"
      ON "ReviewSessionAuditLog" ("review_session_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_review_session_audit_milestone"
      ON "ReviewSessionAuditLog" ("milestone_code")
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'FK_review_session_audit_review_session'
            AND table_name = 'ReviewSessionAuditLog'
        ) THEN
          ALTER TABLE "ReviewSessionAuditLog"
          ADD CONSTRAINT "FK_review_session_audit_review_session"
          FOREIGN KEY ("review_session_id") REFERENCES "ReviewSession"("id") ON DELETE SET NULL;
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'FK_review_session_audit_semester'
            AND table_name = 'ReviewSessionAuditLog'
        ) THEN
          ALTER TABLE "ReviewSessionAuditLog"
          ADD CONSTRAINT "FK_review_session_audit_semester"
          FOREIGN KEY ("semester_id") REFERENCES "Semester"("id") ON DELETE CASCADE;
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'FK_review_session_audit_group'
            AND table_name = 'ReviewSessionAuditLog'
        ) THEN
          ALTER TABLE "ReviewSessionAuditLog"
          ADD CONSTRAINT "FK_review_session_audit_group"
          FOREIGN KEY ("group_id") REFERENCES "Group"("id") ON DELETE CASCADE;
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'FK_review_session_audit_actor_user'
            AND table_name = 'ReviewSessionAuditLog'
        ) THEN
          ALTER TABLE "ReviewSessionAuditLog"
          ADD CONSTRAINT "FK_review_session_audit_actor_user"
          FOREIGN KEY ("actor_user_id") REFERENCES "User"("id") ON DELETE SET NULL;
        END IF;
      END
      $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_review_session_group_day_active"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "ReviewSessionAuditLog"`);
    await queryRunner.query(`
      ALTER TABLE "ReviewSession"
      DROP COLUMN IF EXISTS "review_day",
      DROP COLUMN IF EXISTS "what_done_since_last_review",
      DROP COLUMN IF EXISTS "next_plan_until_next_review",
      DROP COLUMN IF EXISTS "previous_problem_followup",
      DROP COLUMN IF EXISTS "current_problems",
      DROP COLUMN IF EXISTS "attendance_ratio",
      DROP COLUMN IF EXISTS "deleted_at"
    `);
    await queryRunner.query(`
      ALTER TABLE "GroupReview"
      DROP COLUMN IF EXISTS "auto_score",
      DROP COLUMN IF EXISTS "final_score",
      DROP COLUMN IF EXISTS "override_reason",
      DROP COLUMN IF EXISTS "scoring_formula",
      DROP COLUMN IF EXISTS "scoring_config_snapshot",
      DROP COLUMN IF EXISTS "metric_total_problems",
      DROP COLUMN IF EXISTS "metric_resolved_ratio",
      DROP COLUMN IF EXISTS "metric_overdue_task_ratio",
      DROP COLUMN IF EXISTS "metric_attendance_ratio"
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reviewsessionauditlog_action_enum') THEN
          DROP TYPE "reviewsessionauditlog_action_enum";
        END IF;
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'groupreview_scoring_formula_enum') THEN
          DROP TYPE "groupreview_scoring_formula_enum";
        END IF;
      END
      $$;
    `);
  }
}
