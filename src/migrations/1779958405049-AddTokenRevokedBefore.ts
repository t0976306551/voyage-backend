import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTokenRevokedBefore1779958405049 implements MigrationInterface {
    name = 'AddTokenRevokedBefore1779958405049'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "token_revoked_before" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "trips" ALTER COLUMN "enabled_modules" SET DEFAULT '{"tasks":true,"expenses":true,"checklists":true}'`);
        await queryRunner.query(`ALTER TABLE "trips" ALTER COLUMN "collaborator_permissions" SET DEFAULT '{"canEditTripInfo":true,"canInvite":true,"canDeleteContent":true,"canManageModules":true,"canEditContent":true}'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "trips" ALTER COLUMN "collaborator_permissions" SET DEFAULT '{"canInvite": true, "canEditContent": true, "canEditTripInfo": true, "canDeleteContent": true, "canManageModules": true}'`);
        await queryRunner.query(`ALTER TABLE "trips" ALTER COLUMN "enabled_modules" SET DEFAULT '{"tasks": true, "expenses": true, "checklists": true}'`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "token_revoked_before"`);
    }

}
