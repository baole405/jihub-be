import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import {
  ReviewMilestoneCode,
  ReviewSessionAuditAction,
} from '../common/enums';
import { Group } from './group.entity';
import { ReviewSession } from './review-session.entity';
import { Semester } from './semester.entity';
import { User } from './user.entity';

@Entity('ReviewSessionAuditLog')
@Index('IDX_review_session_audit_group', ['group_id'])
@Index('IDX_review_session_audit_semester', ['semester_id'])
@Index('IDX_review_session_audit_review_session', ['review_session_id'])
@Index('IDX_review_session_audit_milestone', ['milestone_code'])
export class ReviewSessionAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  review_session_id: string | null;

  @Column({ type: 'uuid' })
  semester_id: string;

  @Column({ type: 'uuid' })
  group_id: string;

  @Column({ type: 'enum', enum: ReviewMilestoneCode })
  milestone_code: ReviewMilestoneCode;

  @Column({ type: 'enum', enum: ReviewSessionAuditAction })
  action: ReviewSessionAuditAction;

  @Column({ type: 'int' })
  version_number: number;

  @Column({ type: 'uuid', nullable: true })
  actor_user_id: string | null;

  @Column({ type: 'jsonb' })
  snapshot: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @ManyToOne(() => ReviewSession, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'review_session_id' })
  review_session: ReviewSession | null;

  @ManyToOne(() => Semester, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'semester_id' })
  semester: Semester;

  @ManyToOne(() => Group, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'group_id' })
  group: Group;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'actor_user_id' })
  actor_user: User | null;
}
