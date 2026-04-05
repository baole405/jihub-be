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
import { ReviewMilestoneCode } from '../common/enums';
import { Class } from './class.entity';
import { Semester } from './semester.entity';

@Entity('ClassCheckpoint')
@Unique('UQ_CLASS_CHECKPOINT_CLASS_SEMESTER_NUMBER', [
  'class_id',
  'semester_id',
  'checkpoint_number',
])
@Index('IDX_CLASS_CHECKPOINT_CLASS', ['class_id'])
@Index('IDX_CLASS_CHECKPOINT_SEMESTER', ['semester_id'])
export class ClassCheckpoint {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  class_id: string;

  @Column({ type: 'uuid' })
  semester_id: string;

  @Column({ type: 'int' })
  checkpoint_number: number;

  @Column({
    type: 'enum',
    enum: ReviewMilestoneCode,
  })
  milestone_code: ReviewMilestoneCode;

  @Column({ type: 'int' })
  deadline_week: number;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @ManyToOne(() => Class, (cls) => cls.checkpoints, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'class_id' })
  class: Class;

  @ManyToOne(() => Semester, (semester) => semester.checkpoints, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'semester_id' })
  semester: Semester;
}
