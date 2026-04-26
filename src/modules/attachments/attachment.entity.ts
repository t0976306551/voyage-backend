import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
} from 'typeorm';

@Entity('attachments')
export class Attachment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'trip_id' })
  tripId!: string;

  @Column({ name: 'file_key' })
  fileKey!: string;

  @Column({ name: 'file_type' })
  fileType!: string;

  @Column({ name: 'original_name' })
  originalName!: string;

  @Column({ name: 'is_offline_available', default: false })
  isOfflineAvailable!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
