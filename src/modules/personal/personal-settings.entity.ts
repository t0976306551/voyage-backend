import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

@Entity('personal_settings')
@Index(['tripId', 'userId'], { unique: true })
export class PersonalSettings {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'trip_id' })
  tripId!: string;

  @Column({ name: 'user_id' })
  userId!: string;

  @Column({ name: 'memos_shared', default: false })
  memosShared!: boolean;

  @Column({ name: 'expenses_shared', default: false })
  expensesShared!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
