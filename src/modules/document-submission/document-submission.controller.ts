import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthorizedRequest } from '../auth/auth.controller';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DocumentSubmissionService } from './document-submission.service';
import { CreateDocumentSubmissionDto } from './dto/create-submission.dto';
import { GradeDocumentDto } from './dto/grade-submission.dto';

@ApiTags('Document Submissions')
@Controller('documents')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DocumentSubmissionController {
  constructor(private readonly submissionService: DocumentSubmissionService) {}

  @Get()
  @ApiOperation({ summary: 'Get all submissions (Lecturers)' })
  async getAllSubmissions() {
    return this.submissionService.getAllSubmissions();
  }

  @Get('group/:groupId')
  @ApiOperation({ summary: 'Get submissions for a specific group' })
  async getGroupSubmissions(@Param('groupId') groupId: string) {
    return this.submissionService.getGroupSubmissions(groupId);
  }

  @Post('group/:groupId')
  @ApiOperation({ summary: 'Submit a new document for a group' })
  async submitDocument(
    @Req() req: AuthorizedRequest,
    @Param('groupId') groupId: string,
    @Body() dto: CreateDocumentSubmissionDto,
  ) {
    return this.submissionService.submitDocument(groupId, req.user.id, dto);
  }

  @Patch(':id/grade')
  @ApiOperation({ summary: 'Grade or update document status (Lecturer only)' })
  async gradeDocument(
    @Req() req: AuthorizedRequest,
    @Param('id') submissionId: string,
    @Body() dto: GradeDocumentDto,
  ) {
    return this.submissionService.gradeDocument(
      submissionId,
      req.user.id,
      req.user.role,
      dto,
    );
  }
}
