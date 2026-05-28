import { MigrationInterface, QueryRunner } from "typeorm";

export class AddInviteCodeExpiresAt1779957998529 implements MigrationInterface {
    name = 'AddInviteCodeExpiresAt1779957998529'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "trips" ADD "invite_code_expires_at" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "trips" ALTER COLUMN "enabled_modules" SET DEFAULT '{"tasks":true,"expenses":true,"checklists":true}'`);
        await queryRunner.query(`ALTER TABLE "trips" ALTER COLUMN "collaborator_permissions" SET DEFAULT '{"canEditTripInfo":true,"canInvite":true,"canDeleteContent":true,"canManageModules":true,"canEditContent":true}'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "trips" ALTER COLUMN "collaborator_permissions" SET DEFAULT '{"canInvite": true, "canEditContent": true, "canEditTripInfo": true, "canDeleteContent": true, "canManageModules": true}'`);
        await queryRunner.query(`ALTER TABLE "trips" ALTER COLUMN "enabled_modules" SET DEFAULT '{"tasks": true, "expenses": true, "checklists": true}'`);
        await queryRunner.query(`ALTER TABLE "trips" DROP COLUMN "invite_code_expires_at"`);
    }

}
