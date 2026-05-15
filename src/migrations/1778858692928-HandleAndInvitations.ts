import { MigrationInterface, QueryRunner } from "typeorm";

export class HandleAndInvitations1778858692928 implements MigrationInterface {
    name = 'HandleAndInvitations1778858692928'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "trip_invitations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "trip_id" character varying NOT NULL, "invited_user_id" character varying NOT NULL, "invited_by_user_id" character varying NOT NULL, "status" character varying(20) NOT NULL DEFAULT 'pending', "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_61d76800affe23ad68c5e0a3f5e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "users" ADD "handle" character varying(10) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "UQ_6a7e5f591436179c411f5308a9e" UNIQUE ("handle")`);
        await queryRunner.query(`ALTER TABLE "trips" ALTER COLUMN "enabled_modules" SET DEFAULT '{"tasks":true,"expenses":true,"checklists":true}'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "trips" ALTER COLUMN "enabled_modules" SET DEFAULT '{"tasks": true, "expenses": true, "checklists": true}'`);
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "UQ_6a7e5f591436179c411f5308a9e"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "handle"`);
        await queryRunner.query(`DROP TABLE "trip_invitations"`);
    }

}
