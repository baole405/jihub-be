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
import { Role } from '../../common/enums';
import type { AuthorizedRequest } from '../auth/auth.controller';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { DocumentSubmissionService } from './document-submission.service';
import { CreateDocumentSubmissionDto } from './dto/create-submission.dto';
import { GradeDocumentDto } from './dto/grade-submission.dto';

@ApiTags('Document Submissions')
@Controller('documents')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class DocumentSubmissionController {
  constructor(private readonly submissionService: DocumentSubmissionService) {}

  @Get()
  @Roles(Role.LECTURER)
  @ApiOperation({ summary: 'Get all submissions (Lecturers only)' })
  async getAllSubmissions() {
    return this.submissionService.getAllSubmissions();
  }

  @Get('group/:groupId')
  @ApiOperation({ summary: 'Get submissions for a specific group' })
  async getGroupSubmissions(@Param('groupId') groupId: string) {
    return this.submissionService.getGroupSubmissions(groupId);
  }

  @Get('group/:groupId/versions')
  @ApiOperation({ summary: 'Get version history for a specific group' })
  async getGroupVersions(@Param('groupId') groupId: string) {
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

  @Post('group/:groupId/drafts')
  @ApiOperation({ summary: 'Save a draft version for a group document' })
  async saveDraftVersion(
    @Req() req: AuthorizedRequest,
    @Param('groupId') groupId: string,
    @Body() dto: CreateDocumentSubmissionDto,
  ) {
    return this.submissionService.saveDraftVersion(groupId, req.user.id, dto);
  }

  @Patch(':id/submit')
  @ApiOperation({ summary: 'Submit a selected version to the lecturer' })
  async submitVersion(
    @Req() req: AuthorizedRequest,
    @Param('id') submissionId: string,
  ) {
    return this.submissionService.submitVersion(submissionId, req.user.id);
  }

  @Patch(':id/grade')
  @Roles(Role.LECTURER)
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
