import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
} from 'typeorm';

@Entity('trip_invitations')
export class TripInvitation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'trip_id' })
  tripId!: string;

  @Column({ name: 'invited_user_id' })
  invitedUserId!: string;

  @Column({ name: 'invited_by_user_id' })
  invitedByUserId!: string;

  @Column({ default: 'pending', length: 20 })
  status!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
