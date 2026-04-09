import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DocumentStatus } from '../common/enums';
import { Group } from './group.entity';
import { User } from './user.entity';

@Entity('DocumentSubmission')
export class DocumentSubmission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  group_id: string;

  @Column({ type: 'uuid', nullable: true })
  base_submission_id: string | null;

  @Column({ type: 'int', default: 1 })
  version_number: number;

  @Column({ type: 'uuid' })
  submitted_by_id: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  document_url: string | null;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  reference: string | null;

  @Column({ type: 'text', nullable: true })
  change_summary: string | null;

  @Column({
    type: 'enum',
    enum: DocumentStatus,
    default: DocumentStatus.PENDING,
  })
  status: DocumentStatus;

  @Column({ type: 'float', nullable: true })
  score: number | null;

  @Column({ type: 'text', nullable: true })
  feedback: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @ManyToOne(() => Group, (group) => group.submissions)
  @JoinColumn({ name: 'group_id' })
  group: Group;

  @ManyToOne(
    () => DocumentSubmission,
    (submission) => submission.nextVersions,
    {
      nullable: true,
    },
  )
  @JoinColumn({ name: 'base_submission_id' })
  baseSubmission: DocumentSubmission | null;

  @OneToMany(
    () => DocumentSubmission,
    (submission) => submission.baseSubmission,
  )
  nextVersions: DocumentSubmission[];

  @ManyToOne(() => User, (user) => user.submissions)
  @JoinColumn({ name: 'submitted_by_id' })
  submittedBy: User;
}
