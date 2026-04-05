import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class CheckpointConfigItemDto {
  @ApiProperty({ example: 1, description: 'Checkpoint number (1, 2, or 3)' })
  @IsInt()
  @Min(1)
  @Max(3)
  checkpoint_number: number;

  @ApiProperty({
    example: 3,
    description: 'Deadline week for this checkpoint (1-15)',
  })
  @IsInt()
  @Min(1)
  @Max(15)
  deadline_week: number;

  @ApiProperty({
    example: 'Complete SRS document and present initial design',
    required: false,
    description: 'Requirement description for students',
  })
  @IsOptional()
  @IsString()
  description?: string;
}

export class UpsertClassCheckpointsDto {
  @ApiProperty({ type: [CheckpointConfigItemDto] })
  @IsArray()
  @ArrayMinSize(3)
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => CheckpointConfigItemDto)
  checkpoints: CheckpointConfigItemDto[];
}
