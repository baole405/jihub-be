import { ApiProperty } from '@nestjs/swagger';
import { GroupStatus } from '../../../common/enums';

export class ClassAnalyticsSummaryDto {
  @ApiProperty({ example: 25 })
  total_students: number;

  @ApiProperty({ example: 7 })
  total_groups: number;

  @ApiProperty({ example: 5 })
  groups_with_topic: number;

  @ApiProperty({ example: 2 })
  groups_without_topic: number;

  @ApiProperty({ example: 4 })
  groups_with_github: number;

  @ApiProperty({ example: 3 })
  groups_with_jira: number;
}

export class GroupAnalyticsItemDto {
  @ApiProperty({ example: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Group 1' })
  name: string;

  @ApiProperty({ enum: GroupStatus, example: GroupStatus.ACTIVE })
  status: GroupStatus;

  @ApiProperty({ example: 'E-Commerce Platform', nullable: true })
  topic_name: string | null;

  @ApiProperty({ example: 4 })
  member_count: number;

  @ApiProperty({ example: 2 })
  linked_repos_count: number;

  @ApiProperty({ example: 3 })
  submission_count: number;

  @ApiProperty({ example: 8.5, nullable: true })
  graded_avg_score: number | null;

  @ApiProperty({ example: true })
  has_github: boolean;

  @ApiProperty({ example: true })
  has_jira: boolean;
}

export class ClassAnalyticsResponseDto {
  @ApiProperty({ example: 'uuid' })
  class_id: string;

  @ApiProperty({ example: 'Software Development Project' })
  class_name: string;

  @ApiProperty({ example: 'SWP391' })
  class_code: string;

  @ApiProperty({ example: 'SP26', nullable: true })
  semester: string | null;

  @ApiProperty({ type: ClassAnalyticsSummaryDto })
  summary: ClassAnalyticsSummaryDto;

  @ApiProperty({ type: [GroupAnalyticsItemDto] })
  groups: GroupAnalyticsItemDto[];
}
