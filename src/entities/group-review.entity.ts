import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { ReviewMilestoneCode, ReviewScoringFormula } from '../common/enums';
import { Group } from './group.entity';
import { Semester } from './semester.entity';
import { User } from './user.entity';

@Entity('GroupReview')
@Unique('UQ_GROUP_REVIEW_SEMESTER_GROUP_MILESTONE', [
  'semester_id',
  'group_id',
  'milestone_code',
])
@Index('IDX_GROUP_REVIEW_SEMESTER', ['semester_id'])
@Index('IDX_GROUP_REVIEW_GROUP', ['group_id'])
@Index('IDX_GROUP_REVIEW_MILESTONE', ['milestone_code'])
export class GroupReview {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  semester_id: string;

  @Column({ type: 'uuid' })
  group_id: string;

  @Column({
    type: 'enum',
    enum: ReviewMilestoneCode,
  })
  milestone_code: ReviewMilestoneCode;

  @Column({ type: 'int' })
  week_start: number;

  @Column({ type: 'int' })
  week_end: number;

  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true })
  task_progress_score: number | null;

  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true })
  commit_contribution_score: number | null;

  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true })
  review_milestone_score: number | null;

  @Column({ type: 'text', nullable: true })
  lecturer_note: string | null;

  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true })
  auto_score: number | null;

  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true })
  final_score: number | null;

  @Column({ type: 'text', nullable: true })
  override_reason: string | null;

  @Column({
    type: 'enum',
    enum: ReviewScoringFormula,
    nullable: true,
  })
  scoring_formula: ReviewScoringFormula | null;

  @Column({ type: 'jsonb', nullable: true })
  scoring_config_snapshot: Record<string, unknown> | null;

  @Column({ type: 'int', default: 0 })
  metric_total_problems: number;

  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true })
  metric_resolved_ratio: number | null;

  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true })
  metric_overdue_task_ratio: number | null;

  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true })
  metric_attendance_ratio: number | null;

  @Column({ type: 'int', default: 0 })
  snapshot_task_total: number;

  @Column({ type: 'int', default: 0 })
  snapshot_task_done: number;

  @Column({ type: 'int', nullable: true })
  snapshot_commit_total: number | null;

  @Column({ type: 'int', nullable: true })
  snapshot_commit_contributors: number | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  snapshot_repository: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  snapshot_captured_at: Date | null;

  @Column({ type: 'boolean', default: false })
  is_published: boolean;

  @Column({ type: 'uuid', nullable: true })
  updated_by_id: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @ManyToOne(() => Semester, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'semester_id' })
  semester: Semester;

  @ManyToOne(() => Group, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'group_id' })
  group: Group;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'updated_by_id' })
  updated_by: User | null;
}
