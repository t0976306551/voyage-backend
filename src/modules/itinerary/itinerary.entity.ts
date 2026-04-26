import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
} from 'typeorm';

@Entity('itinerary')
export class Itinerary {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'trip_id' })
  tripId!: string;

  @Column()
  day!: number;

  @Column()
  title!: string;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  lat!: number;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  lng!: number;

  @Column({ name: 'source_url', nullable: true })
  sourceUrl!: string;

  @Column({ default: 0 })
  order!: number;

  @Column({ nullable: true })
  note!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
