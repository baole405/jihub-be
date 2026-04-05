import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClassCheckpoint } from '../../entities/class-checkpoint.entity';
import { ClassMembership } from '../../entities/class-membership.entity';
import { Class } from '../../entities/class.entity';
import { DocumentSubmission } from '../../entities/document-submission.entity';
import { GroupMembership } from '../../entities/group-membership.entity';
import { GroupRepository as GroupRepositoryEntity } from '../../entities/group-repository.entity';
import { GroupReview } from '../../entities/group-review.entity';
import { Group } from '../../entities/group.entity';
import { Notification } from '../../entities/notification.entity';
import { Semester } from '../../entities/semester.entity';
import { User } from '../../entities/user.entity';
import { MailModule } from '../mail/mail.module';
import { ClassCheckpointController } from './class-checkpoint.controller';
import { ClassCheckpointService } from './class-checkpoint.service';
import { ClassController } from './class.controller';
import { ClassService } from './class.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Class,
      ClassCheckpoint,
      ClassMembership,
      DocumentSubmission,
      Group,
      GroupMembership,
      GroupRepositoryEntity,
      GroupReview,
      Notification,
      Semester,
      User,
    ]),
    MailModule,
  ],
  providers: [ClassService, ClassCheckpointService],
  controllers: [ClassController, ClassCheckpointController],
  exports: [TypeOrmModule, ClassCheckpointService],
})
export class ClassModule {}
