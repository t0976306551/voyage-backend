import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
} from 'typeorm';

@Entity('personal_memos')
export class PersonalMemo {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'trip_id' })
  tripId!: string;

  @Column({ name: 'user_id' })
  userId!: string;

  @Column({ length: 100 })
  title!: string;

  @Column({ name: 'sort_order', default: 0 })
  sortOrder!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
