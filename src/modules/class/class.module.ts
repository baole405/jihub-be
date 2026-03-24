import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClassMembership } from '../../entities/class-membership.entity';
import { Class } from '../../entities/class.entity';
import { DocumentSubmission } from '../../entities/document-submission.entity';
import { GroupMembership } from '../../entities/group-membership.entity';
import { GroupRepository as GroupRepositoryEntity } from '../../entities/group-repository.entity';
import { Group } from '../../entities/group.entity';
import { Notification } from '../../entities/notification.entity';
import { User } from '../../entities/user.entity';
import { MailModule } from '../mail/mail.module';
import { ClassController } from './class.controller';
import { ClassService } from './class.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Class,
      ClassMembership,
      DocumentSubmission,
      Group,
      GroupMembership,
      GroupRepositoryEntity,
      Notification,
      User,
    ]),
    MailModule,
  ],
  providers: [ClassService],
  controllers: [ClassController],
  exports: [TypeOrmModule],
})
export class ClassModule {}
