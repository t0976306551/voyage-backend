import {
  Entity, PrimaryColumn, Column, Index,
} from 'typeorm';

@Entity('checklist_assignments')
@Index('idx_checklist_assign_user_status', ['userId', 'completedAt'])
export class ChecklistAssignment {
  @PrimaryColumn({ name: 'item_id', type: 'uuid' })
  itemId!: string;

  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt!: Date | null;

  @Column({ name: 'assigned_at', type: 'timestamptz', default: () => 'now()' })
  assignedAt!: Date;
}
