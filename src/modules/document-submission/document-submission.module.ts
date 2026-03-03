import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentSubmission } from '../../entities/document-submission.entity';
import { GroupMembership } from '../../entities/group-membership.entity';
import { DocumentSubmissionController } from './document-submission.controller';
import { DocumentSubmissionService } from './document-submission.service';

@Module({
  imports: [TypeOrmModule.forFeature([DocumentSubmission, GroupMembership])],
  providers: [DocumentSubmissionService],
  controllers: [DocumentSubmissionController],
  exports: [TypeOrmModule],
})
export class DocumentSubmissionModule {}
