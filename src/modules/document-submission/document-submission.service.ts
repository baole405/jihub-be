import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Role } from '../../common/enums';
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
    // Only Leader or members can submit? Let's say any member
    const membership = await this.membershipRepo.findOne({
      where: { group_id: groupId, user_id: userId, left_at: IsNull() },
    });

    if (!membership) {
      throw new ForbiddenException('You are not a member of this group');
    }

    const submission = this.submissionRepo.create({
      group_id: groupId,
      submitted_by_id: userId,
      title: dto.title,
      document_url: dto.document_url,
    });

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
      relations: ['submittedBy'],
      order: { created_at: 'DESC' },
    });
  }

  async getAllSubmissions() {
    return this.submissionRepo.find({
      relations: ['group', 'submittedBy'],
      order: { created_at: 'DESC' },
    });
  }
}
