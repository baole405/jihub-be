import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateSemesterClassDto {
  @ApiProperty({ example: 'SWP391-1004' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code: string;

  @ApiProperty({ example: 'SWP391 Cohort 1004' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiProperty({
    example: 'AB12CD34',
    required: false,
    description: 'Optional custom enrollment key. Generated when omitted.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  enrollment_key?: string;
}
