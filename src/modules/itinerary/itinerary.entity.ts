import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
} from 'typeorm';

export type SpotCategory = 'food' | 'lodging' | 'attraction' | 'activity' | 'transport' | 'admin';

@Entity('itinerary')
export class Itinerary {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'trip_id' })
  tripId!: string;

  @Column({ nullable: true, type: 'integer' })
  day!: number | null;

  @Column()
  title!: string;

  @Column({ type: 'varchar', nullable: true, default: 'attraction' })
  category!: SpotCategory | null;

  @Column({ type: 'varchar', name: 'cover_image', nullable: true })
  coverImage!: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  lat!: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  lng!: number | null;

  @Column({ name: 'source_url', type: 'varchar', nullable: true })
  sourceUrl!: string | null;

  @Column({ default: 0 })
  order!: number;

  @Column({ type: 'varchar', nullable: true })
  note!: string | null;

  @Column({ name: 'start_time', type: 'time', nullable: true })
  startTime!: string | null;

  @Column({ name: 'duration_minutes', type: 'integer', nullable: true })
  durationMinutes!: number | null;

  @Column({ type: 'text', nullable: true })
  address!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
