import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
} from 'typeorm';

export type TripRole = 'Owner' | 'Editor' | 'Viewer';

export interface TripMember {
  userId: string;
  role: TripRole;
}

@Entity('trips')
export class Trip {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  title!: string;

  @Column({ name: 'start_date', type: 'date', nullable: true })
  startDate!: string;

  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate!: string;

  @Column({ name: 'invite_code', unique: true })
  inviteCode!: string;

  @Column({ name: 'cover_image', nullable: true })
  coverImage!: string;

  @Column({ type: 'jsonb', default: '[]' })
  members!: TripMember[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
