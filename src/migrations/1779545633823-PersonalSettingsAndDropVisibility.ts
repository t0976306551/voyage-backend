import { MigrationInterface, QueryRunner } from "typeorm";

export class PersonalSettingsAndDropVisibility1779545633823 implements MigrationInterface {
    name = 'PersonalSettingsAndDropVisibility1779545633823'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "personal_settings" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "trip_id" character varying NOT NULL, "user_id" character varying NOT NULL, "memos_shared" boolean NOT NULL DEFAULT false, "expenses_shared" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_54339f8d83a95c18f6072941b12" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_e6eb0904e1e929b74b250186a7" ON "personal_settings" ("trip_id", "user_id") `);
        await queryRunner.query(`ALTER TABLE "personal_memos" DROP COLUMN "visibility"`);
        await queryRunner.query(`ALTER TABLE "personal_expenses" DROP COLUMN "visibility"`);
        await queryRunner.query(`ALTER TABLE "trips" ALTER COLUMN "enabled_modules" SET DEFAULT '{"tasks":true,"expenses":true,"checklists":true}'`);
        await queryRunner.query(`ALTER TABLE "trips" ALTER COLUMN "collaborator_permissions" SET DEFAULT '{"canEditTripInfo":true,"canInvite":true,"canDeleteContent":true,"canManageModules":true,"canEditContent":true}'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "trips" ALTER COLUMN "collaborator_permissions" SET DEFAULT '{"canInvite": true, "canEditContent": true, "canEditTripInfo": true, "canDeleteContent": true, "canManageModules": true}'`);
        await queryRunner.query(`ALTER TABLE "trips" ALTER COLUMN "enabled_modules" SET DEFAULT '{"tasks": true, "expenses": true, "checklists": true}'`);
        await queryRunner.query(`ALTER TABLE "personal_expenses" ADD "visibility" character varying NOT NULL DEFAULT 'private'`);
        await queryRunner.query(`ALTER TABLE "personal_memos" ADD "visibility" character varying NOT NULL DEFAULT 'private'`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e6eb0904e1e929b74b250186a7"`);
        await queryRunner.query(`DROP TABLE "personal_settings"`);
    }

}
