import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { ReviewScoringFormula } from '../../../common/enums';

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

  @ApiPropertyOptional({
    enum: ReviewScoringFormula,
    example: ReviewScoringFormula.ATTENDANCE_PROBLEM_CONTRIBUTION,
  })
  @IsOptional()
  @IsEnum(ReviewScoringFormula)
  scoring_formula?: ReviewScoringFormula;

  @ApiPropertyOptional({
    example: ['ATTENDANCE', 'PROBLEM_RESOLUTION', 'CONTRIBUTION'],
    description: 'Only used when scoring_formula is CUSTOM_SELECTION.',
  })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  selected_metrics?: string[];

  @ApiPropertyOptional({
    example: 8.5,
    description:
      'Optional lecturer override over the computed auto score. Requires override_reason when different from auto score.',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  final_score?: number;

  @ApiPropertyOptional({
    example: 'Auto score does not reflect the recovery work completed after the last review.',
  })
  @IsOptional()
  @IsString()
  override_reason?: string;
}
