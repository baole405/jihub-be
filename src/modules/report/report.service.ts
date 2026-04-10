import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import Groq from 'groq-sdk';
import { Repository } from 'typeorm';
import { MembershipRole } from '../../common/enums';
import { SemesterStatus } from '../../common/enums/semester-status.enum';
import { Group } from '../../entities/group.entity';
import { ProjectLink } from '../../entities/project-link.entity';
import { Semester } from '../../entities/semester.entity';
import { GithubService } from '../github/github.service';
import { JiraService } from '../jira/jira.service';

@Injectable()
export class ReportService {
  private readonly logger = new Logger(ReportService.name);
  private groq: Groq;

  constructor(
    @InjectRepository(Group)
    private readonly groupRepository: Repository<Group>,
    @InjectRepository(ProjectLink)
    private readonly projectLinkRepository: Repository<ProjectLink>,
    private readonly jiraService: JiraService,
    private readonly githubService: GithubService,
  ) {}

  private getGroqClient(): Groq {
    if (!this.groq) {
      const apiKey = process.env.GROQ_API_KEY;
      if (!apiKey) {
        throw new BadRequestException(
          'GROQ_API_KEY environment variable is missing.',
        );
      }
      this.groq = new Groq({ apiKey });
    }
    return this.groq;
  }

  private extractErrorMessage(error: unknown, fallback: string) {
    if (error instanceof HttpException) {
      const response = error.getResponse() as
        | { message?: string }
        | string
        | undefined;
      if (typeof response === 'string') {
        return response;
      }
      if (response?.message) {
        return response.message;
      }
    }

    if (error instanceof Error && error.message) {
      return error.message;
    }

    return fallback;
  }

  async generateSrs(
    groupId: string,
    userId: string,
  ): Promise<{ markdown: string }> {
    const group = await this.groupRepository.findOne({
      where: { id: groupId },
      relations: ['members', 'members.user', 'topic', 'class'],
    });
    if (!group) throw new NotFoundException('Group not found');

    await this.assertSemesterIsInteractive(group);

    if (!group.jira_project_key) {
      throw new BadRequestException(
        'This group has not linked a Jira project yet',
      );
    }

    const leader = group.members?.find(
      (m) => m.role_in_group === MembershipRole.LEADER,
    );
    const jiraTokenUserId = leader
      ? leader.user_id || leader.user?.id
      : group.created_by_id;

    // 1. Fetch raw data from Jira
    const rawJiraData = await this.jiraService.getProjectIssues(
      jiraTokenUserId,
      group.jira_project_key,
    );

    const issueSummary = rawJiraData
      .map((issue: any, index: number) => {
        const issueType = issue.issueType || 'Issue';
        const status = issue.status ? ` | Status: ${issue.status}` : '';
        return `${index + 1}. [${issueType}] ${issue.key}: ${issue.summary}${status}`;
      })
      .join('\n');

    // 2. Synthesize input prompt
    const prompt = `You are a professional Business Analyst and System Architect.
Generate a complete SRS in Markdown for the project below.

Rules:
- Do not return a blank template.
- Do not leave headings empty.
- Fill functional requirements with concrete numbered requirements.
- Fill non-functional requirements with measurable quality constraints.
- Use the topic/context below as the primary source of truth.
- Use the Jira issues only as supporting evidence.
- If the Jira data is sparse, infer sensible details from the topic context instead of leaving placeholders.
- Return only Markdown.

Project context:
- Group: ${group.name}
- Topic: ${group.topic?.name || 'Not selected'}
- Topic context: ${group.topic?.description || 'No topic description provided.'}
- Class context: ${group.class?.name || 'Unknown class'}
- Semester: ${group.class?.semester || 'Unknown'}

Suggested section structure:
## 1. Introduction
## 2. Overall Description
## 3. Functional Requirements
## 4. Non-Functional Requirements
## 5. System Architecture / Constraints
## 6. Assumptions

Jira issue summary:
${issueSummary || 'No Jira issues were returned.'}

Raw Jira data:
${JSON.stringify(rawJiraData, null, 2)}`;

    // 3. Request Markdown generation via Groq
    const groqClient = this.getGroqClient();
    const chatCompletion = await groqClient.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'allam-2-7b',
      temperature: 0.2,
    });

    const markdownOutput =
      chatCompletion.choices[0]?.message?.content || '# Error generating SRS';

    if (this.isTrivialMarkdown(markdownOutput)) {
      return {
        markdown: this.buildFallbackSrsMarkdown(group, issueSummary),
      };
    }

    return { markdown: markdownOutput };
  }

  async generateAssignmentReport(groupId: string, userId: string) {
    const group = await this.groupRepository.findOne({
      where: { id: groupId },
      relations: ['members', 'members.user', 'class'],
    });
    if (!group) throw new NotFoundException('Group not found');

    await this.assertSemesterIsInteractive(group);

    if (!group.jira_project_key) {
      this.logger.warn(
        JSON.stringify({
          event: 'assignments_report_unlinked_jira',
          group_id: groupId,
          hint: 'link_jira_project_before_fetching_assignments',
        }),
      );
      return {
        groupName: group.name,
        totalTasks: 0,
        assignments: [],
        warnings: [
          'This group has not linked a Jira project yet. Assignment data is unavailable.',
        ],
      };
    }

    const leader = group.members?.find(
      (m) => m.role_in_group === MembershipRole.LEADER,
    );
    const jiraTokenUserId = leader
      ? leader.user_id || leader.user?.id
      : group.created_by_id;

    let rawJiraData: any[] = [];
    const warnings: string[] = [];

    try {
      rawJiraData = await this.jiraService.getProjectIssues(
        jiraTokenUserId,
        group.jira_project_key,
      );
    } catch (error) {
      this.logger.warn(
        JSON.stringify({
          event: 'assignments_report_jira_fetch_failed',
          group_id: groupId,
          hint: 'relink_jira_if_token_is_expired',
          message: this.extractErrorMessage(
            error,
            'Failed to fetch Jira assignment data for this group.',
          ),
        }),
      );
      warnings.push(
        this.extractErrorMessage(
          error,
          'Failed to fetch Jira assignment data for this group.',
        ),
      );
    }

    // Simplistic breakdown for frontend rendering
    const assignments = rawJiraData.map((issue: any) => ({
      key: issue.key,
      summary: issue.summary,
      status: issue.status,
      assignee: issue.assignee?.displayName || 'Unassigned',
      type: issue.issueType,
    }));

    return {
      groupName: group.name,
      totalTasks: assignments.length,
      assignments,
      warnings,
    };
  }

  async generateCommitReport(groupId: string, userId: string) {
    const group = await this.groupRepository.findOne({
      where: { id: groupId },
      relations: ['members', 'members.user', 'class'],
    });
    if (!group) throw new NotFoundException('Group not found');

    await this.assertSemesterIsInteractive(group);

    // To avoid circular dependency / too many modules in report, we can inject GroupRepository repository just for fetching linked repos.
    // Wait, reportService constructor needs it. Let's just import it if needed.
    // Wait, instead of modifying constructor to add groupRepoRepository, we can temporarily query the database via query builder
    // or add `groupRepoRepository` to ReportService constructor.
    // Actually, I'll just use queryBuilder on groupRepository to join GroupRepository.

    const repos = await this.groupRepository.manager
      .createQueryBuilder('GroupRepository', 'gr')
      .where('gr.group_id = :groupId', { groupId })
      .getMany();

    if (!repos || repos.length === 0) {
      return {
        groupName: group.name,
        repositories: [],
        computing: false,
        warnings: [
          'This group has not linked any GitHub repositories yet. Commit analytics are unavailable.',
        ],
      };
    }

    const allStats: any[] = [];
    let anyComputing = false;
    const warnings: string[] = [];

    // Fetch stats for all linked repositories
    for (const repo of repos) {
      try {
        const result = await this.githubService.getRepoContributorsStats(
          repo.added_by_id,
          repo.repo_owner,
          repo.repo_name,
        );
        if (result.computing) {
          anyComputing = true;
        }
        allStats.push({
          repository: `${repo.repo_owner}/${repo.repo_name}`,
          contributors: result.contributors,
        });
      } catch (e) {
        warnings.push(
          `${repo.repo_owner}/${repo.repo_name}: ${this.extractErrorMessage(
            e,
            'Failed to fetch commit analytics for this repository.',
          )}`,
        );
      }
    }

    return {
      groupName: group.name,
      repositories: allStats,
      computing: anyComputing,
      warnings,
    };
  }

  private async assertSemesterIsInteractive(group: Group) {
    const semesterCode = group.class?.semester;
    if (!semesterCode) {
      return;
    }

    const semester = await this.groupRepository.manager
      .getRepository(Semester)
      .findOne({ where: { code: semesterCode } });

    if (semester?.status === SemesterStatus.UPCOMING) {
      throw new ForbiddenException(
        'This action is not available for UPCOMING semesters.',
      );
    }
  }

  private isTrivialMarkdown(markdown: string) {
    const normalized = markdown.trim().toLowerCase();
    if (!normalized) {
      return true;
    }

    if (normalized === '# error generating srs') {
      return true;
    }

    return ['tbd', 'todo', 'lorem ipsum', 'placeholder'].some((signal) =>
      normalized.includes(signal),
    );
  }

  private buildFallbackSrsMarkdown(group: Group, issueSummary: string) {
    const issueLines = issueSummary
      ? issueSummary.split('\n').filter(Boolean)
      : [];

    const functionalRequirements = issueLines.length
      ? issueLines.map(
          (line, index) => `- FR-${index + 1}: Derived from ${line}`,
        )
      : [
          '- FR-01: The system shall support the core workflow described by the approved topic.',
          '- FR-02: The system shall allow students to create, edit, and submit SRS drafts.',
          '- FR-03: The system shall allow lecturers to review, approve, reject, and grade SRS submissions.',
        ];

    return [
      `# ${group.topic?.name || group.name} SRS`,
      '',
      '## 1. Introduction',
      `- Purpose: Define the software requirements for ${group.topic?.name || group.name}.`,
      `- Scope: Deliver a student team project with structured planning, implementation, and review workflow.`,
      '',
      '## 2. Overall Description',
      `- Product perspective: ${group.topic?.description || 'The solution supports the group project lifecycle.'}`,
      '- Users: students, group leaders, lecturers, and admins.',
      '- Constraints: integrate with Jira/GitHub when linked, and preserve version history for each draft.',
      '',
      '## 3. Functional Requirements',
      ...functionalRequirements,
      '',
      '## 4. Non-Functional Requirements',
      '- NFR-01: The system shall respond within a reasonable time for common SRS actions.',
      '- NFR-02: The system shall preserve submission version history and review decisions.',
      '- NFR-03: The system shall protect unauthorized access to group and lecturer actions.',
      '- NFR-04: The system shall keep generated documents consistent and editable by students.',
      '',
      '## 5. System Architecture / Constraints',
      '- Version control is stored as document submission records.',
      '- Jira tasks are used as implementation evidence when available.',
      '- GitHub integrations are optional but improve traceability.',
      '',
      '## 6. Assumptions',
      '- The group has an approved topic before final submission.',
      '- Jira data may be sparse, so the document may rely on topic context.',
      '- Lecturer feedback is stored alongside each version.',
    ].join('\n');
  }
}
