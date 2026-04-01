import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  TaskJiraSyncStatus,
  TaskPriority,
  TaskStatus,
} from '../../../common/enums';

export class TaskResponseEntity {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiPropertyOptional({ example: null, nullable: true })
  key?: string | null;

  @ApiPropertyOptional({
    example: 'SWP-123',
    nullable: true,
    description: 'Jira issue key for the synced internal task',
  })
  jira_issue_key?: string | null;

  @ApiProperty({ example: '11111111-1111-1111-1111-111111111111' })
  group_id: string;

  @ApiProperty({ example: 'Prepare API contract for mobile task list' })
  title: string;

  @ApiPropertyOptional({
    example: 'Return pagination and assignee display name.',
  })
  description?: string | null;

  @ApiProperty({ enum: TaskStatus, example: TaskStatus.TODO })
  status: TaskStatus;

  @ApiProperty({ enum: TaskPriority, example: TaskPriority.HIGH })
  priority: TaskPriority;

  @ApiPropertyOptional({
    example: '22222222-2222-2222-2222-222222222222',
    nullable: true,
  })
  assignee_id?: string | null;

  @ApiPropertyOptional({ example: 'Nguyen Van A', nullable: true })
  assignee_name?: string | null;

  @ApiProperty({
    enum: TaskJiraSyncStatus,
    example: TaskJiraSyncStatus.SUCCESS,
  })
  jira_sync_status: TaskJiraSyncStatus;

  @ApiPropertyOptional({
    example: 'INSUFFICIENT_SCOPE',
    nullable: true,
    description:
      'Reason code for Jira sync failure/skip, e.g. INSUFFICIENT_SCOPE, TOKEN_EXPIRED, NOT_LINKED, NO_PROJECT_KEY',
  })
  jira_sync_reason?: string | null;

  @ApiPropertyOptional({ example: '2026-03-25T10:00:00.000Z', nullable: true })
  due_at?: Date | null;

  @ApiProperty({ example: '2026-03-20T10:00:00.000Z' })
  created_at: Date;

  @ApiProperty({ example: '2026-03-20T10:00:00.000Z' })
  updated_at: Date;
}

export class PaginatedTasksEntity {
  @ApiProperty({ type: [TaskResponseEntity] })
  data: TaskResponseEntity[];

  @ApiProperty({
    example: { total: 25, page: 1, limit: 20, total_pages: 2 },
  })
  meta: {
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  };
}
