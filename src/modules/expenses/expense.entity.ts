import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
} from 'typeorm';

@Entity('expenses')
export class Expense {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'trip_id' })
  tripId!: string;

  @Column({ name: 'payer_id' })
  payerId!: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount!: number;

  @Column({ default: 'TWD' })
  currency!: string;

  @Column({ nullable: true })
  description!: string;

  @Column({ name: 'split_info', type: 'jsonb', default: '{}' })
  splitInfo!: Record<string, number>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
