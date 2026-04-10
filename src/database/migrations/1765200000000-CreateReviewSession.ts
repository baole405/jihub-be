import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class CreateReviewSession1765200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reviewsession_status_enum') THEN
          CREATE TYPE "reviewsession_status_enum" AS ENUM (
            'SCHEDULED',
            'COMPLETED',
            'CANCELLED'
          );
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reviewsession_milestone_code_enum') THEN
          CREATE TYPE "reviewsession_milestone_code_enum" AS ENUM (
            'REVIEW_1',
            'REVIEW_2',
            'REVIEW_3',
            'FINAL_SCORE'
          );
        END IF;
      END
      $$;
    `);

    await queryRunner.createTable(
      new Table({
        name: 'ReviewSession',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'semester_id', type: 'uuid' },
          { name: 'class_id', type: 'uuid' },
          { name: 'group_id', type: 'uuid' },
          { name: 'milestone_code', type: 'reviewsession_milestone_code_enum' },
          { name: 'review_date', type: 'timestamptz' },
          { name: 'title', type: 'varchar', length: '160' },
          {
            name: 'status',
            type: 'reviewsession_status_enum',
            default: "'COMPLETED'",
          },
          { name: 'lecturer_note', type: 'text', isNullable: true },
          {
            name: 'participant_reports',
            type: 'jsonb',
            default: "'[]'::jsonb",
          },
          { name: 'created_by_id', type: 'uuid', isNullable: true },
          { name: 'updated_by_id', type: 'uuid', isNullable: true },
          {
            name: 'created_at',
            type: 'timestamptz',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamptz',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
    );

    await queryRunner.createForeignKeys('ReviewSession', [
      new TableForeignKey({
        columnNames: ['semester_id'],
        referencedTableName: 'Semester',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
      new TableForeignKey({
        columnNames: ['class_id'],
        referencedTableName: 'Class',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
      new TableForeignKey({
        columnNames: ['group_id'],
        referencedTableName: 'Group',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
      new TableForeignKey({
        columnNames: ['created_by_id'],
        referencedTableName: 'User',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
      new TableForeignKey({
        columnNames: ['updated_by_id'],
        referencedTableName: 'User',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    ]);

    await queryRunner.createIndices('ReviewSession', [
      new TableIndex({
        name: 'IDX_review_session_semester',
        columnNames: ['semester_id'],
      }),
      new TableIndex({
        name: 'IDX_review_session_class',
        columnNames: ['class_id'],
      }),
      new TableIndex({
        name: 'IDX_review_session_group',
        columnNames: ['group_id'],
      }),
      new TableIndex({
        name: 'IDX_review_session_milestone',
        columnNames: ['milestone_code'],
      }),
      new TableIndex({
        name: 'IDX_review_session_review_date',
        columnNames: ['review_date'],
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('ReviewSession', true);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reviewsession_status_enum') THEN
          DROP TYPE "reviewsession_status_enum";
        END IF;
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reviewsession_milestone_code_enum') THEN
          DROP TYPE "reviewsession_milestone_code_enum";
        END IF;
      END
      $$;
    `);
  }
}
