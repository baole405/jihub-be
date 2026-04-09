import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { DocumentStatus, Role } from '../../common/enums';
import { DocumentSubmission } from '../../entities/document-submission.entity';
import { GroupMembership } from '../../entities/group-membership.entity';
import { CreateDocumentSubmissionDto } from './dto/create-submission.dto';
import { GradeDocumentDto } from './dto/grade-submission.dto';

@Injectable()
export class DocumentSubmissionService {
  constructor(
    @InjectRepository(DocumentSubmission)
    private readonly submissionRepo: Repository<DocumentSubmission>,
    @InjectRepository(GroupMembership)
    private readonly membershipRepo: Repository<GroupMembership>,
  ) {}

  async submitDocument(
    groupId: string,
    userId: string,
    dto: CreateDocumentSubmissionDto,
  ) {
    return this.createSubmissionVersion(groupId, userId, dto, {
      status: DocumentStatus.PENDING,
    });
  }

  async saveDraftVersion(
    groupId: string,
    userId: string,
    dto: CreateDocumentSubmissionDto,
  ) {
    return this.createSubmissionVersion(groupId, userId, dto, {
      status: DocumentStatus.DRAFT,
    });
  }

  async submitVersion(submissionId: string, userId: string) {
    const submission = await this.submissionRepo.findOne({
      where: { id: submissionId },
    });

    if (!submission) {
      throw new NotFoundException('Submission not found');
    }

    const membership = await this.membershipRepo.findOne({
      where: {
        group_id: submission.group_id,
        user_id: userId,
        left_at: IsNull(),
      },
    });

    if (!membership) {
      throw new ForbiddenException('You are not a member of this group');
    }

    submission.status = DocumentStatus.PENDING;
    return this.submissionRepo.save(submission);
  }

  async gradeDocument(
    submissionId: string,
    lecturerId: string,
    role: string,
    dto: GradeDocumentDto,
  ) {
    if ((role as Role) !== Role.LECTURER && (role as Role) !== Role.ADMIN) {
      throw new ForbiddenException('Only lecturers can grade documents');
    }

    const submission = await this.submissionRepo.findOne({
      where: { id: submissionId },
    });

    if (!submission) {
      throw new NotFoundException('Submission not found');
    }

    submission.status = dto.status;
    if (dto.score !== undefined) submission.score = dto.score;
    if (dto.feedback !== undefined) submission.feedback = dto.feedback;

    return this.submissionRepo.save(submission);
  }

  async getGroupSubmissions(groupId: string) {
    return this.submissionRepo.find({
      where: { group_id: groupId },
      relations: ['submittedBy', 'baseSubmission'],
      order: { version_number: 'DESC', created_at: 'DESC' },
    });
  }

  async getAllSubmissions() {
    return this.submissionRepo.find({
      relations: ['group', 'submittedBy'],
      order: { created_at: 'DESC' },
    });
  }

  private async createSubmissionVersion(
    groupId: string,
    userId: string,
    dto: CreateDocumentSubmissionDto,
    options: { status: DocumentStatus },
  ) {
    const membership = await this.membershipRepo.findOne({
      where: { group_id: groupId, user_id: userId, left_at: IsNull() },
    });

    if (!membership) {
      throw new ForbiddenException('You are not a member of this group');
    }

    const latestVersion = await this.submissionRepo.findOne({
      where: { group_id: groupId },
      order: { version_number: 'DESC' },
      select: { version_number: true },
    });

    const submission = this.submissionRepo.create({
      group_id: groupId,
      submitted_by_id: userId,
      title: dto.title,
      document_url: dto.document_url ?? dto.reference ?? null,
      reference: dto.reference ?? dto.document_url ?? null,
      change_summary: dto.change_summary ?? null,
      base_submission_id: dto.base_submission_id ?? null,
      version_number: (latestVersion?.version_number ?? 0) + 1,
      status: options.status,
    });

    return this.submissionRepo.save(submission);
  }
}
