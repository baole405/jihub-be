import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateChatTables1761700000000 implements MigrationInterface {
  name = 'CreateChatTables1761700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "public"."Conversation_status_enum" AS ENUM('ACTIVE', 'CLOSED')
    `);
    await queryRunner.query(`
      CREATE TYPE "public"."Message_type_enum" AS ENUM('TEXT', 'SYSTEM')
    `);
    await queryRunner.query(`
      CREATE TABLE "Conversation" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "semester_id" uuid NOT NULL,
        "class_id" uuid NOT NULL,
        "student_id" uuid NOT NULL,
        "lecturer_id" uuid NOT NULL,
        "status" "public"."Conversation_status_enum" NOT NULL DEFAULT 'ACTIVE',
        "last_message_preview" character varying(255),
        "last_message_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_Conversation_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_conversation_context_pair" UNIQUE ("semester_id", "class_id", "student_id", "lecturer_id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_conversation_student_updated_at" ON "Conversation" ("student_id", "updated_at" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_conversation_lecturer_updated_at" ON "Conversation" ("lecturer_id", "updated_at" DESC)
    `);
    await queryRunner.query(`
      ALTER TABLE "Conversation"
      ADD CONSTRAINT "FK_conversation_semester" FOREIGN KEY ("semester_id") REFERENCES "Semester"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "Conversation"
      ADD CONSTRAINT "FK_conversation_class" FOREIGN KEY ("class_id") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "Conversation"
      ADD CONSTRAINT "FK_conversation_student" FOREIGN KEY ("student_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "Conversation"
      ADD CONSTRAINT "FK_conversation_lecturer" FOREIGN KEY ("lecturer_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      CREATE TABLE "Message" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "conversation_id" uuid NOT NULL,
        "sender_id" uuid NOT NULL,
        "content" text NOT NULL,
        "type" "public"."Message_type_enum" NOT NULL DEFAULT 'TEXT',
        "client_id" character varying(100),
        "read_by_recipient_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_Message_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_message_conversation_client_id" UNIQUE ("conversation_id", "client_id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_message_conversation_created_at" ON "Message" ("conversation_id", "created_at" DESC)
    `);
    await queryRunner.query(`
      ALTER TABLE "Message"
      ADD CONSTRAINT "FK_message_conversation" FOREIGN KEY ("conversation_id") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "Message"
      ADD CONSTRAINT "FK_message_sender" FOREIGN KEY ("sender_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "Message" DROP CONSTRAINT "FK_message_sender"`,
    );
    await queryRunner.query(
      `ALTER TABLE "Message" DROP CONSTRAINT "FK_message_conversation"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_message_conversation_created_at"`,
    );
    await queryRunner.query(`DROP TABLE "Message"`);

    await queryRunner.query(
      `ALTER TABLE "Conversation" DROP CONSTRAINT "FK_conversation_lecturer"`,
    );
    await queryRunner.query(
      `ALTER TABLE "Conversation" DROP CONSTRAINT "FK_conversation_student"`,
    );
    await queryRunner.query(
      `ALTER TABLE "Conversation" DROP CONSTRAINT "FK_conversation_class"`,
    );
    await queryRunner.query(
      `ALTER TABLE "Conversation" DROP CONSTRAINT "FK_conversation_semester"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_conversation_lecturer_updated_at"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_conversation_student_updated_at"`,
    );
    await queryRunner.query(`DROP TABLE "Conversation"`);

    await queryRunner.query(`DROP TYPE "public"."Message_type_enum"`);
    await queryRunner.query(`DROP TYPE "public"."Conversation_status_enum"`);
  }
}
