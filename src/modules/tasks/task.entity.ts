import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
} from 'typeorm';

export type TaskStatus = 'todo' | 'in_progress' | 'done';
export type TaskCategory = 'general' | 'esim' | 'visa' | 'accommodation' | 'transport';

@Entity('tasks')
export class Task {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'trip_id' })
  tripId!: string;

  @Column({ name: 'assigned_user_id', nullable: true })
  assignedUserId!: string;

  @Column()
  title!: string;

  @Column({ default: 'general' })
  category!: TaskCategory;

  @Column({ default: 'todo' })
  status!: TaskStatus;

  @Column({ name: 'due_date', type: 'date', nullable: true })
  dueDate!: string;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
