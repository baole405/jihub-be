import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpsertGroupReviewDto {
  @ApiPropertyOptional({
    example: 8.5,
    description: 'Quick lecturer score for task progress',
    minimum: 0,
    maximum: 10,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  task_progress_score?: number;

  @ApiPropertyOptional({
    example: 7.5,
    description: 'Quick lecturer score for commit contribution',
    minimum: 0,
    maximum: 10,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  commit_contribution_score?: number;

  @ApiPropertyOptional({
    example: 8,
    description: 'Milestone review score for the current review window',
    minimum: 0,
    maximum: 10,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  review_milestone_score?: number;

  @ApiPropertyOptional({
    example: 'Team is on track. Need clearer task ownership for week 6.',
    description: 'Short lecturer note',
  })
  @IsOptional()
  @IsString()
  lecturer_note?: string;
}
