import { MigrationInterface, QueryRunner } from "typeorm";

export class TaskNotes1779321600000 implements MigrationInterface {
    name = 'TaskNotes1779321600000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tasks" ADD "notes" text`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tasks" DROP COLUMN "notes"`);
    }
}
