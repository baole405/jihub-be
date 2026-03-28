import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Class,
  Group,
  GroupMembership,
  GroupRepository,
  IntegrationToken,
  Topic,
  User,
} from '../../entities';
import { GithubModule } from '../github/github.module';
import { JiraModule } from '../jira/jira.module';
import { GroupsController } from './groups.controller';
import { GroupsService } from './groups.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Class,
      Group,
      GroupMembership,
      GroupRepository,
      IntegrationToken,
      User,
      Topic,
    ]),
    GithubModule,
    JiraModule,
  ],
  controllers: [GroupsController],
  providers: [GroupsService],
  exports: [GroupsService],
})
export class GroupsModule {}
