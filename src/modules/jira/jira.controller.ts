import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { AuthorizedRequest } from '../auth/auth.controller';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { JiraProject } from './jira.service';
import { JiraService } from './jira.service';

export class LinkProjectDto {
  github_repo_full_name: string;
  jira_project_id: string;
}

@ApiTags('Jira')
@Controller('jira')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class JiraController {
  constructor(private readonly jiraService: JiraService) {}

  @Get('projects')
  @ApiOperation({ summary: 'Get accessible Jira projects for the user' })
  @ApiResponse({ status: 200, description: 'List of Jira projects' })
  async getProjects(@Req() req: AuthorizedRequest): Promise<JiraProject[]> {
    return this.jiraService.getProjects(req.user.id);
  }

  @Post('projects/link')
  @ApiOperation({ summary: 'Link a GitHub repository to a Jira project' })
  @ApiResponse({ status: 201, description: 'Project linked successfully' })
  async linkProject(
    @Req() req: AuthorizedRequest,
    @Body() dto: LinkProjectDto,
  ) {
    return await this.jiraService.linkProject(
      req.user.id,
      dto.github_repo_full_name,
      dto.jira_project_id,
    );
  }
}
