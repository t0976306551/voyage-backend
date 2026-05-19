import { MigrationInterface, QueryRunner } from "typeorm";

export class InitSchema1779198546000 implements MigrationInterface {
    name = 'InitSchema1779198546000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying NOT NULL, "handle" character varying(10) NOT NULL, "name" character varying, "google_id" character varying, "line_id" character varying, "avatar" character varying, "push_token" character varying, "password_hash" character varying(72), "email_verified" boolean NOT NULL DEFAULT false, "auth_providers" text array NOT NULL DEFAULT '{}', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "UQ_6a7e5f591436179c411f5308a9e" UNIQUE ("handle"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "trips" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "title" character varying NOT NULL, "start_date" date, "end_date" date, "invite_code" character varying NOT NULL, "cover_image" character varying, "members" jsonb NOT NULL DEFAULT '[]', "enabled_modules" jsonb NOT NULL DEFAULT '{"tasks":true,"expenses":true,"checklists":true}', "collaborator_permissions" jsonb NOT NULL DEFAULT '{"canEditTripInfo":true,"canInvite":true,"canDeleteContent":true,"canManageModules":true,"canEditContent":true}', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_589b48ad9c7a81a7ecaea211ac4" UNIQUE ("invite_code"), CONSTRAINT "PK_f71c231dee9c05a9522f9e840f5" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "itinerary" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "trip_id" character varying NOT NULL, "day" integer, "title" character varying NOT NULL, "category" character varying DEFAULT 'attraction', "cover_image" character varying, "lat" numeric(10,7), "lng" numeric(10,7), "source_url" character varying, "order" integer NOT NULL DEFAULT '0', "note" character varying, "start_time" TIME, "duration_minutes" integer, "address" text, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_515a9607ae33d4536f40d60f85e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "expenses" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "trip_id" character varying NOT NULL, "payer_id" character varying NOT NULL, "amount" numeric(10,2) NOT NULL, "currency" character varying NOT NULL DEFAULT 'TWD', "description" character varying, "split_info" jsonb NOT NULL DEFAULT '{}', "paid_back" jsonb NOT NULL DEFAULT '{}', "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_94c3ceb17e3140abc9282c20610" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "tasks" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "trip_id" character varying NOT NULL, "assigned_user_id" character varying, "title" character varying NOT NULL, "category" character varying NOT NULL DEFAULT 'general', "status" character varying NOT NULL DEFAULT 'todo', "due_date" date, "notes" text, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_8d12ff38fcc62aaba2cab748772" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "attachments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "trip_id" character varying NOT NULL, "file_key" character varying NOT NULL, "file_type" character varying NOT NULL, "original_name" character varying NOT NULL, "is_offline_available" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_5e1f050bcff31e3084a1d662412" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "checklist_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "trip_id" uuid NOT NULL, "title" character varying NOT NULL, "notes" text, "created_by_id" uuid NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_bae00945a1d4789bd648e583e29" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_checklist_items_trip" ON "checklist_items" ("trip_id", "created_at") `);
        await queryRunner.query(`CREATE TABLE "checklist_assignments" ("item_id" uuid NOT NULL, "user_id" uuid NOT NULL, "completed_at" TIMESTAMP WITH TIME ZONE, "assigned_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_418ca7eca97290f77d0787eb539" PRIMARY KEY ("item_id", "user_id"))`);
        await queryRunner.query(`CREATE INDEX "idx_checklist_assign_user_status" ON "checklist_assignments" ("user_id", "completed_at") `);
        await queryRunner.query(`CREATE TABLE "trip_invitations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "trip_id" character varying NOT NULL, "invited_user_id" character varying NOT NULL, "invited_by_user_id" character varying NOT NULL, "status" character varying(20) NOT NULL DEFAULT 'pending', "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_61d76800affe23ad68c5e0a3f5e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "invitation_history" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "inviter_user_id" uuid NOT NULL, "invitee_user_id" uuid NOT NULL, "first_invited_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "last_invited_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "invite_count" integer NOT NULL DEFAULT '1', "hidden_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "uq_invitation_history" UNIQUE ("inviter_user_id", "invitee_user_id"), CONSTRAINT "PK_8df590b3d47b841d4f5bc346bd8" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_ih_inviter" ON "invitation_history" ("inviter_user_id") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."idx_ih_inviter"`);
        await queryRunner.query(`DROP TABLE "invitation_history"`);
        await queryRunner.query(`DROP TABLE "trip_invitations"`);
        await queryRunner.query(`DROP INDEX "public"."idx_checklist_assign_user_status"`);
        await queryRunner.query(`DROP TABLE "checklist_assignments"`);
        await queryRunner.query(`DROP INDEX "public"."idx_checklist_items_trip"`);
        await queryRunner.query(`DROP TABLE "checklist_items"`);
        await queryRunner.query(`DROP TABLE "attachments"`);
        await queryRunner.query(`DROP TABLE "tasks"`);
        await queryRunner.query(`DROP TABLE "expenses"`);
        await queryRunner.query(`DROP TABLE "itinerary"`);
        await queryRunner.query(`DROP TABLE "trips"`);
        await queryRunner.query(`DROP TABLE "users"`);
    }

}
