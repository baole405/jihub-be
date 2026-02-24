import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Role, AuthProvider } from '../common/enums';
import { IntegrationToken } from './integration-token.entity';
import { Group } from './group.entity';
import { GroupMembership } from './group-membership.entity';

@Entity('User')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, unique: true, nullable: true })
  student_id: string | null;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  password_hash: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  full_name: string | null;

  @Column({ type: 'enum', enum: AuthProvider, default: AuthProvider.EMAIL })
  primary_provider: AuthProvider;

  @Column({ type: 'enum', enum: Role, default: Role.STUDENT })
  role: Role;

  @Column({ type: 'boolean', default: false })
  is_email_verified: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @Column({ type: 'timestamptz', nullable: true })
  last_login: Date | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  avatar_url: string | null;

  @OneToMany(() => IntegrationToken, (token) => token.user)
  integrationTokens: IntegrationToken[];

  @OneToMany(() => Group, (group) => group.creator)
  createdGroups: Group[];

  @OneToMany(() => GroupMembership, (membership) => membership.user)
  memberships: GroupMembership[];
}
