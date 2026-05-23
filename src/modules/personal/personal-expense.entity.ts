import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
} from 'typeorm';

export type PersonalExpenseCategory = 'food' | 'transport' | 'lodging' | 'shopping' | 'activity' | 'other';

@Entity('personal_expenses')
export class PersonalExpense {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'trip_id' })
  tripId!: string;

  @Column({ name: 'user_id' })
  userId!: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount!: string;

  @Column({ default: 'TWD', length: 10 })
  currency!: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  description!: string | null;

  @Column({ default: 'other' })
  category!: PersonalExpenseCategory;

  @Column({ name: 'spent_at', type: 'date', nullable: true })
  spentAt!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
