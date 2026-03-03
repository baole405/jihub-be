import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUrl } from 'class-validator';

export class CreateDocumentSubmissionDto {
  @ApiProperty({ example: 'SRS Document v1' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 'https://docs.google.com/document/d/123/edit' })
  @IsUrl()
  @IsNotEmpty()
  document_url: string;
}
