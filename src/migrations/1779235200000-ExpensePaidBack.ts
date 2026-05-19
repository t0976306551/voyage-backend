import { MigrationInterface, QueryRunner } from "typeorm";

export class ExpensePaidBack1779235200000 implements MigrationInterface {
    name = 'ExpensePaidBack1779235200000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "expenses" ADD "paid_back" jsonb NOT NULL DEFAULT '{}'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "expenses" DROP COLUMN "paid_back"`);
    }
}
