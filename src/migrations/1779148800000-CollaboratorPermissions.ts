import { MigrationInterface, QueryRunner } from "typeorm";

export class CollaboratorPermissions1779148800000 implements MigrationInterface {
    name = 'CollaboratorPermissions1779148800000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "trips" ADD "collaborator_permissions" jsonb NOT NULL DEFAULT '{"canEditTripInfo":true,"canInvite":true,"canDeleteContent":true,"canManageModules":true}'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "trips" DROP COLUMN "collaborator_permissions"`);
    }
}
