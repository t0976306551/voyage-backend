import { MigrationInterface, QueryRunner } from "typeorm";

export class InvitationHistory1779408000000 implements MigrationInterface {
    name = 'InvitationHistory1779408000000'

    public async up(q: QueryRunner): Promise<void> {
        await q.query(`CREATE TABLE "invitation_history" (
          "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
          "inviter_user_id" uuid NOT NULL,
          "invitee_user_id" uuid NOT NULL,
          "first_invited_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
          "last_invited_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),
          "invite_count" integer NOT NULL DEFAULT 1,
          "hidden_at" TIMESTAMPTZ,
          CONSTRAINT "uq_invitation_history" UNIQUE ("inviter_user_id","invitee_user_id"),
          CONSTRAINT "fk_ih_inviter" FOREIGN KEY ("inviter_user_id") REFERENCES "users"("id") ON DELETE CASCADE,
          CONSTRAINT "fk_ih_invitee" FOREIGN KEY ("invitee_user_id") REFERENCES "users"("id") ON DELETE CASCADE
        )`);
        await q.query(`CREATE INDEX "idx_ih_inviter_visible" ON "invitation_history"("inviter_user_id") WHERE "hidden_at" IS NULL`);

        // Backfill from existing trip_invitations.
        // Note: trip_invitations.invited_*_user_id are character varying, so cast to uuid.
        // Filter rows that actually parse as uuid and reference existing users to avoid FK violations.
        await q.query(`
          INSERT INTO "invitation_history" ("inviter_user_id", "invitee_user_id", "first_invited_at", "last_invited_at", "invite_count")
          SELECT
            ti.invited_by_user_id::uuid,
            ti.invited_user_id::uuid,
            MIN(ti.created_at),
            MAX(ti.created_at),
            COUNT(*)::int
          FROM "trip_invitations" ti
          WHERE ti.invited_by_user_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            AND ti.invited_user_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            AND EXISTS (SELECT 1 FROM "users" u WHERE u.id = ti.invited_by_user_id::uuid)
            AND EXISTS (SELECT 1 FROM "users" u WHERE u.id = ti.invited_user_id::uuid)
            AND ti.invited_by_user_id::uuid <> ti.invited_user_id::uuid
          GROUP BY ti.invited_by_user_id, ti.invited_user_id
          ON CONFLICT ("inviter_user_id","invitee_user_id") DO NOTHING
        `);
    }

    public async down(q: QueryRunner): Promise<void> {
        await q.query(`DROP INDEX IF EXISTS "idx_ih_inviter_visible"`);
        await q.query(`DROP TABLE IF EXISTS "invitation_history"`);
    }
}
