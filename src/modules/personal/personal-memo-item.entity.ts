import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
} from 'typeorm';

@Entity('personal_memo_items')
export class PersonalMemoItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'memo_id' })
  memoId!: string;

  @Column({ length: 200 })
  title!: string;

  @Column({ default: false })
  completed!: boolean;

  @Column({ name: 'sort_order', default: 0 })
  sortOrder!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
