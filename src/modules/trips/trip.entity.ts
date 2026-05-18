import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
} from 'typeorm';

export type TripRole = 'Owner' | 'Editor' | 'Viewer';

export interface TripMember {
  userId: string;
  role: TripRole;
}

export interface CollaboratorPermissions {
  canEditTripInfo: boolean;
  canInvite: boolean;
  canDeleteContent: boolean;
  canManageModules: boolean;
}

export const DEFAULT_COLLABORATOR_PERMISSIONS: CollaboratorPermissions = {
  canEditTripInfo: true,
  canInvite: true,
  canDeleteContent: true,
  canManageModules: true,
};

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

  @Column({
    name: 'enabled_modules',
    type: 'jsonb',
    default: () => `'{"tasks":true,"expenses":true,"checklists":true}'`,
  })
  enabledModules!: { tasks: boolean; expenses: boolean; checklists: boolean };

  @Column({
    name: 'collaborator_permissions',
    type: 'jsonb',
    default: () => `'{"canEditTripInfo":true,"canInvite":true,"canDeleteContent":true,"canManageModules":true}'`,
  })
  collaboratorPermissions!: CollaboratorPermissions;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
