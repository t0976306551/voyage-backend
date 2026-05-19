import {
  Entity, PrimaryGeneratedColumn, Column, Index, Unique,
} from 'typeorm';

@Entity('invitation_history')
@Unique('uq_invitation_history', ['inviterUserId', 'inviteeUserId'])
@Index('idx_ih_inviter', ['inviterUserId'])
export class InvitationHistory {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'inviter_user_id', type: 'uuid' })
  inviterUserId!: string;

  @Column({ name: 'invitee_user_id', type: 'uuid' })
  inviteeUserId!: string;

  @Column({ name: 'first_invited_at', type: 'timestamptz', default: () => 'now()' })
  firstInvitedAt!: Date;

  @Column({ name: 'last_invited_at', type: 'timestamptz', default: () => 'now()' })
  lastInvitedAt!: Date;

  @Column({ name: 'invite_count', type: 'int', default: 1 })
  inviteCount!: number;

  @Column({ name: 'hidden_at', type: 'timestamptz', nullable: true })
  hiddenAt!: Date | null;
}
