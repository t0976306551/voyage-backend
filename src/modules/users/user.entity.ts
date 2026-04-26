import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
} from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  email!: string;

  @Column({ nullable: true })
  name!: string;

  @Column({ nullable: true, name: 'google_id' })
  googleId!: string;

  @Column({ nullable: true, name: 'line_id' })
  lineId!: string;

  @Column({ nullable: true })
  avatar!: string;

  @Column({ nullable: true, name: 'push_token' })
  pushToken!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
