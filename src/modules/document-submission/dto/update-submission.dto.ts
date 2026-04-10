import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateDocumentSubmissionDto {
  @ApiPropertyOptional({ example: 'SRS Document v2' })
  @IsOptional()
  @IsString()
  title?: string;

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
    example: 'Refined scope and added acceptance criteria for FR-07.',
    description: 'Optional short summary of what changed in this version.',
  })
  @IsOptional()
  @IsString()
  change_summary?: string;

  @ApiPropertyOptional({
    example: '# Software Requirements Specification\n\n## 1. Introduction\n...',
    description: 'Optional markdown content of this SRS version.',
  })
  @IsOptional()
  @IsString()
  content_markdown?: string;
}
