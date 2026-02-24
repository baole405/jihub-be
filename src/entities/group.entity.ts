import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { GroupStatus } from '../common/enums';
import { User } from './user.entity';
import { GroupMembership } from './group-membership.entity';

@Entity('Group')
export class Group {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  project_name: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  semester: string | null;

  @Column({ type: 'uuid' })
  created_by_id: string;

  @Column({ type: 'enum', enum: GroupStatus, default: GroupStatus.ACTIVE })
  status: GroupStatus;

  @Column({ type: 'varchar', length: 255, nullable: true })
  github_repo_url: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  jira_project_key: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @ManyToOne(() => User, (user) => user.createdGroups)
  @JoinColumn({ name: 'created_by_id' })
  creator: User;

  @OneToMany(() => GroupMembership, (membership) => membership.group)
  members: GroupMembership[];
}
