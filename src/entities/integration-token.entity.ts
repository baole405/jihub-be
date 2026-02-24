import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { IntegrationProvider } from '../common/enums';
import { User } from './user.entity';

@Entity('IntegrationToken')
@Unique(['user_id', 'provider'])
@Unique(['provider', 'provider_user_id'])
export class IntegrationToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @Column({ type: 'enum', enum: IntegrationProvider })
  provider: IntegrationProvider;

  @Column({ type: 'varchar', length: 255 })
  provider_user_id: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  provider_username: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  provider_email: string | null;

  @Column({ type: 'text' })
  access_token: string;

  @Column({ type: 'text', nullable: true })
  refresh_token: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  token_expires_at: Date | null;

  @Column({ type: 'text', nullable: true })
  scope: string | null;

  @Column({ type: 'boolean', default: false })
  used_for_login: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @Column({ type: 'timestamptz', nullable: true })
  last_refreshed_at: Date | null;

  @ManyToOne(() => User, (user) => user.integrationTokens, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
