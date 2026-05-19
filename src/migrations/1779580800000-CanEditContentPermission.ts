import { MigrationInterface, QueryRunner } from "typeorm";

export class CanEditContentPermission1779580800000 implements MigrationInterface {
    name = 'CanEditContentPermission1779580800000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Update column default for newly-created trips
        await queryRunner.query(`ALTER TABLE "trips" ALTER COLUMN "collaborator_permissions" SET DEFAULT '{"canEditTripInfo":true,"canInvite":true,"canDeleteContent":true,"canManageModules":true,"canEditContent":true}'`);
        // Backfill existing rows that lack the key
        await queryRunner.query(`UPDATE "trips" SET "collaborator_permissions" = jsonb_set("collaborator_permissions", '{canEditContent}', 'true', true) WHERE NOT ("collaborator_permissions" ? 'canEditContent')`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`UPDATE "trips" SET "collaborator_permissions" = "collaborator_permissions" - 'canEditContent'`);
        await queryRunner.query(`ALTER TABLE "trips" ALTER COLUMN "collaborator_permissions" SET DEFAULT '{"canEditTripInfo":true,"canInvite":true,"canDeleteContent":true,"canManageModules":true}'`);
    }
}
