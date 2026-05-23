import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPersonalMemos1779544552729 implements MigrationInterface {
    name = 'AddPersonalMemos1779544552729'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "personal_memos" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "trip_id" character varying NOT NULL, "user_id" character varying NOT NULL, "title" character varying(100) NOT NULL, "visibility" character varying NOT NULL DEFAULT 'private', "sort_order" integer NOT NULL DEFAULT '0', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_0240cccda27bcabd0f6c66bde2e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "personal_memo_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "memo_id" character varying NOT NULL, "title" character varying(200) NOT NULL, "completed" boolean NOT NULL DEFAULT false, "sort_order" integer NOT NULL DEFAULT '0', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_a122ededeec6a37211bc7625308" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "personal_expenses" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "trip_id" character varying NOT NULL, "user_id" character varying NOT NULL, "amount" numeric(10,2) NOT NULL, "currency" character varying(10) NOT NULL DEFAULT 'TWD', "description" character varying(200), "category" character varying NOT NULL DEFAULT 'other', "spent_at" date, "visibility" character varying NOT NULL DEFAULT 'private', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_09163463d44abb06373fe3856fd" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "trips" ALTER COLUMN "enabled_modules" SET DEFAULT '{"tasks":true,"expenses":true,"checklists":true}'`);
        await queryRunner.query(`ALTER TABLE "trips" ALTER COLUMN "collaborator_permissions" SET DEFAULT '{"canEditTripInfo":true,"canInvite":true,"canDeleteContent":true,"canManageModules":true,"canEditContent":true}'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "trips" ALTER COLUMN "collaborator_permissions" SET DEFAULT '{"canInvite": true, "canEditContent": true, "canEditTripInfo": true, "canDeleteContent": true, "canManageModules": true}'`);
        await queryRunner.query(`ALTER TABLE "trips" ALTER COLUMN "enabled_modules" SET DEFAULT '{"tasks": true, "expenses": true, "checklists": true}'`);
        await queryRunner.query(`DROP TABLE "personal_expenses"`);
        await queryRunner.query(`DROP TABLE "personal_memo_items"`);
        await queryRunner.query(`DROP TABLE "personal_memos"`);
    }

}
