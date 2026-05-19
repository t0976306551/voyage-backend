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

  /** Map of userId → ISO timestamp when they marked themselves paid back. Absent = not yet paid. */
  @Column({ name: 'paid_back', type: 'jsonb', default: '{}' })
  paidBack!: Record<string, string>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
