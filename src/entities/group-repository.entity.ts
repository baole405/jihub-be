import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Group } from './group.entity';
import { User } from './user.entity';

@Entity('GroupRepository')
export class GroupRepository {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  group_id: string;

  @Column({ type: 'varchar', length: 500 })
  repo_url: string;

  @Column({ type: 'varchar', length: 255 })
  repo_name: string;

  @Column({ type: 'varchar', length: 255 })
  repo_owner: string;

  @Column({ type: 'boolean', default: false })
  is_primary: boolean;

  @Column({ type: 'uuid' })
  added_by_id: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @ManyToOne(() => Group, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'group_id' })
  group: Group;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'added_by_id' })
  added_by: User;
}
