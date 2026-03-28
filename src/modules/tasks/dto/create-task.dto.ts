import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { TaskPriority, TaskStatus } from '../../../common/enums';
import { IsEnum } from 'class-validator';

export class CreateTaskDto {
  @ApiProperty({
    example: '11111111-1111-1111-1111-111111111111',
    description: 'Target group UUID',
  })
  @IsUUID()
  group_id: string;

  @ApiProperty({ example: 'Prepare API contract for mobile task list' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @ApiPropertyOptional({
    example: 'Return pagination and assignee display name.',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ enum: TaskStatus, example: TaskStatus.TODO })
  @IsEnum(TaskStatus)
  @IsOptional()
  status?: TaskStatus;

  @ApiPropertyOptional({ enum: TaskPriority, example: TaskPriority.HIGH })
  @IsEnum(TaskPriority)
  @IsOptional()
  priority?: TaskPriority;

  @ApiPropertyOptional({
    example: '22222222-2222-2222-2222-222222222222',
    description: 'Assignee user UUID, if any',
  })
  @IsUUID()
  @IsOptional()
  assignee_id?: string | null;

  @ApiPropertyOptional({
    example: '2026-03-25T10:00:00.000Z',
    description: 'ISO datetime',
  })
  @IsISO8601({ strict: true, strictSeparator: true })
  @IsOptional()
  due_at?: string | null;
}
