import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateDocumentSubmissionDto {
  @ApiProperty({ example: 'SRS Document v1' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({
    example: 'https://docs.google.com/document/d/123/edit',
    description:
      'Deprecated. Kept for backward compatibility. Use reference instead.',
  })
  @IsOptional()
  @IsString()
  document_url?: string;

  @ApiPropertyOptional({
    example: 'https://docs.google.com/document/d/123/edit',
    description: 'Optional external resource reference for this version.',
  })
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiPropertyOptional({
    example: 'Added FR-12 checkout flow and refined NFR performance section.',
    description:
      'Optional short summary of what changed in this submission version.',
  })
  @IsOptional()
  @IsString()
  change_summary?: string;

  @ApiPropertyOptional({
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    description: 'Previous submission id this version was based on',
  })
  @IsOptional()
  @IsUUID()
  base_submission_id?: string;
}
