import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateSemesterClassDto {
  @ApiPropertyOptional({ example: 'SWP391-1004' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  code?: string;

  @ApiPropertyOptional({ example: 'SWP391 Cohort 1004' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({
    example: 'ZX98CV76',
    description:
      'Optional enrollment key update. When omitted, the current key remains unchanged.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  enrollment_key?: string;
}
