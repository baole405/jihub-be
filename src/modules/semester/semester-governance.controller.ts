import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiExcludeEndpoint,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { ReviewMilestoneCode, Role } from '../../common/enums';
import type { AuthorizedRequest } from '../auth/auth.controller';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateReviewSessionDto } from './dto/create-review-session.dto';
import { PublishMilestoneReviewsDto } from './dto/publish-milestone-reviews.dto';
import { SetCurrentWeekDto } from './dto/set-current-week.dto';
import { UpdateReviewSessionDto } from './dto/update-review-session.dto';
import { UpsertGroupReviewDto } from './dto/upsert-group-review.dto';
import { SemesterService } from './semester.service';

@ApiTags('Semester Governance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('semesters')
export class SemesterGovernanceController {
  constructor(private readonly semesterService: SemesterService) {}

  @Get('current-week')
  @ApiOperation({
    summary:
      'Get current semester week context for Lecturer/Admin/Student views',
  })
  async getCurrentWeek() {
    return this.semesterService.getCurrentWeek();
  }

  @Get('current/review-milestone')
  @ApiOperation({
    summary:
      'Get current milestone window mapped from semester week. Pass classId for class-specific checkpoint resolution.',
  })
  @ApiQuery({
    name: 'classId',
    required: false,
    description:
      'Optional class UUID — when provided, resolves the checkpoint from class-specific configuration',
  })
  async getCurrentReviewMilestone(@Query('classId') classId?: string) {
    return this.semesterService.getCurrentReviewMilestone(classId);
  }

  @Patch(':id/current-week')
  @ApiExcludeEndpoint()
  async setCurrentWeek(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthorizedRequest,
    @Body() dto: SetCurrentWeekDto,
  ) {
    return this.semesterService.setCurrentWeek(
      id,
      dto.current_week,
      req.user.id,
      req.user.role as Role,
    );
  }

  @Get('current/compliance/lecturer-summary')
  @Roles(Role.LECTURER, Role.ADMIN)
  @ApiOperation({
    summary:
      'Get lecturer/admin weekly compliance summary for the current semester',
  })
  async getLecturerComplianceSummary(
    @Req() req: AuthorizedRequest,
    @Query('classId') classId?: string,
  ) {
    return this.semesterService.getLecturerComplianceSummary(
      req.user.id,
      req.user.role as Role,
      classId,
    );
  }

  @Get('current/compliance/student-warning')
  @Roles(Role.STUDENT, Role.GROUP_LEADER)
  @ApiOperation({
    summary:
      'Get week-based warning payload for the current student/group leader',
  })
  async getStudentWarnings(@Req() req: AuthorizedRequest) {
    return this.semesterService.getStudentWeeklyWarnings(
      req.user.id,
      req.user.role as Role,
    );
  }

  @Get('current/reviews/lecturer-summary')
  @Roles(Role.LECTURER, Role.ADMIN)
  @ApiOperation({
    summary:
      'Get lightweight lecturer review summary for the active review milestone',
  })
  @ApiQuery({
    name: 'classId',
    required: false,
    description: 'Optional class UUID to narrow lecturer review summary',
  })
  async getLecturerReviewSummary(
    @Req() req: AuthorizedRequest,
    @Query('classId') classId?: string,
  ) {
    return this.semesterService.getLecturerReviewSummary(
      req.user.id,
      req.user.role as Role,
      classId,
    );
  }

  @Get('current/review-sessions')
  @Roles(Role.LECTURER, Role.ADMIN)
  @ApiOperation({
    summary:
      'Get review sessions for the current semester, optionally scoped to a class',
  })
  @ApiQuery({
    name: 'classId',
    required: false,
    description: 'Optional class UUID to scope review sessions',
  })
  async listReviewSessions(
    @Req() req: AuthorizedRequest,
    @Query('classId') classId?: string,
  ) {
    return this.semesterService.listReviewSessions(
      req.user.id,
      req.user.role as Role,
      classId,
    );
  }

  @Get('groups/:groupId/review-sessions')
  @Roles(Role.LECTURER, Role.ADMIN, Role.STUDENT, Role.GROUP_LEADER)
  @ApiOperation({ summary: 'Get review session timeline for a group' })
  async listGroupReviewSessions(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Req() req: AuthorizedRequest,
  ) {
    return this.semesterService.listGroupReviewSessions(
      groupId,
      req.user.id,
      req.user.role as Role,
    );
  }

  @Patch('groups/:groupId/review-sessions/:sessionId')
  @Roles(Role.LECTURER, Role.ADMIN)
  @ApiOperation({
    summary:
      'Update a review session for a group while preserving audit history',
  })
  async updateReviewSession(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Req() req: AuthorizedRequest,
    @Body() dto: UpdateReviewSessionDto,
  ) {
    return this.semesterService.updateReviewSession(
      groupId,
      sessionId,
      req.user.id,
      req.user.role as Role,
      dto,
    );
  }

  @Delete('groups/:groupId/review-sessions/:sessionId')
  @Roles(Role.LECTURER, Role.ADMIN)
  @ApiOperation({
    summary:
      'Soft delete a review session for a group while preserving audit history',
  })
  async deleteReviewSession(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Req() req: AuthorizedRequest,
  ) {
    return this.semesterService.deleteReviewSession(
      groupId,
      sessionId,
      req.user.id,
      req.user.role as Role,
    );
  }

  @Get('groups/:groupId/review-session-history')
  @Roles(Role.LECTURER, Role.ADMIN, Role.STUDENT, Role.GROUP_LEADER)
  @ApiOperation({
    summary:
      'Get audit/version history for review sessions of a group, optionally scoped to a milestone',
  })
  @ApiQuery({
    name: 'milestone_code',
    required: false,
    description: 'Optional milestone code to filter history entries',
  })
  async listGroupReviewSessionHistory(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Req() req: AuthorizedRequest,
    @Query('milestone_code') milestoneCode?: string,
  ) {
    return this.semesterService.listGroupReviewSessionHistory(
      groupId,
      req.user.id,
      req.user.role as Role,
      milestoneCode as ReviewMilestoneCode | undefined,
    );
  }

  @Get('current/reviews/student-status')
  @Roles(Role.STUDENT, Role.GROUP_LEADER)
  @ApiOperation({
    summary:
      'Get current review milestone state for the calling student or group leader',
  })
  async getStudentReviewStatus(@Req() req: AuthorizedRequest) {
    return this.semesterService.getStudentReviewStatus(req.user.id);
  }

  @Patch('groups/:groupId/current-review')
  @Roles(Role.LECTURER, Role.ADMIN)
  @ApiOperation({
    summary:
      'Create or update quick lecturer score for the active milestone and snapshot current task/commit evidence',
  })
  async upsertCurrentGroupReview(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Req() req: AuthorizedRequest,
    @Body() dto: UpsertGroupReviewDto,
  ) {
    return this.semesterService.upsertCurrentGroupReview(
      groupId,
      req.user.id,
      req.user.role as Role,
      dto,
    );
  }

  @Post('groups/:groupId/review-sessions')
  @Roles(Role.LECTURER, Role.ADMIN)
  @ApiOperation({
    summary:
      'Create a non-scored review session for a group to capture attendance and progress notes',
  })
  async createReviewSession(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Req() req: AuthorizedRequest,
    @Body() dto: CreateReviewSessionDto,
  ) {
    return this.semesterService.createReviewSession(
      groupId,
      req.user.id,
      req.user.role as Role,
      dto,
    );
  }

  @Patch('current/reviews/publish')
  @Roles(Role.LECTURER, Role.ADMIN)
  @ApiOperation({
    summary:
      'Publish review scores for a milestone, making them visible to students',
  })
  async publishMilestoneReviews(
    @Req() req: AuthorizedRequest,
    @Body() dto: PublishMilestoneReviewsDto,
  ) {
    return this.semesterService.publishMilestoneReviews(
      dto.milestone_code,
      req.user.id,
      req.user.role as Role,
      dto.class_id,
    );
  }

  @Get('current/reviews/student-scores')
  @Roles(Role.STUDENT, Role.GROUP_LEADER)
  @ApiOperation({
    summary:
      'Get all published milestone scores across all checkpoints for the calling student',
  })
  async getStudentPublishedScores(@Req() req: AuthorizedRequest) {
    return this.semesterService.getStudentPublishedScores(req.user.id);
  }
}
