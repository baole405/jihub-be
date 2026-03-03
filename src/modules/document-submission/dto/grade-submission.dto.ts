import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { DocumentStatus } from '../../../common/enums';

export class GradeDocumentDto {
  @ApiProperty({ enum: DocumentStatus, example: 'GRADED' })
  @IsEnum(DocumentStatus)
  @IsNotEmpty()
  status: DocumentStatus;

  @ApiProperty({ example: 8.5 })
  @IsInt()
  @Min(0)
  @Max(10)
  @IsOptional()
  score?: number;

  @ApiProperty({ example: 'Good job on the architecture section' })
  @IsString()
  @IsOptional()
  feedback?: string;
}
