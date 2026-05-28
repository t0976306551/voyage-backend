import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
} from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  email!: string;

  @Column({ unique: true, length: 10 })
  handle!: string;

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

  @Column({ type: 'varchar', nullable: true, name: 'password_hash', length: 72 })
  passwordHash!: string | null;

  @Column({ name: 'email_verified', default: false })
  emailVerified!: boolean;

  @Column('text', { array: true, name: 'auth_providers', default: '{}' })
  authProviders!: string[];

  @Column({ name: 'token_revoked_before', type: 'timestamptz', nullable: true, default: null })
  tokenRevokedBefore!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
