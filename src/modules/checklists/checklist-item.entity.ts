import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

@Entity('checklist_items')
@Index('idx_checklist_items_trip', ['tripId', 'createdAt'])
export class ChecklistItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'trip_id', type: 'uuid' })
  tripId!: string;

  @Column()
  title!: string;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ name: 'created_by_id', type: 'uuid' })
  createdById!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
