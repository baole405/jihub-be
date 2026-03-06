import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import Groq from 'groq-sdk';
import { Repository } from 'typeorm';
import { MembershipRole } from '../../common/enums';
import { Group } from '../../entities/group.entity';
import { ProjectLink } from '../../entities/project-link.entity';
import { GithubService } from '../github/github.service';
import { JiraService } from '../jira/jira.service';

@Injectable()
export class ReportService {
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

  async generateSrs(
    groupId: string,
    userId: string,
  ): Promise<{ markdown: string }> {
    const group = await this.groupRepository.findOne({
      where: { id: groupId },
      relations: ['members', 'members.user'],
    });
    if (!group) throw new NotFoundException('Group not found');

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

    console.log(
      '[DEBUG generateSrs] Group Leader ID:',
      leader?.user_id,
      'Token User ID:',
      jiraTokenUserId,
    );

    // 1. Fetch raw data from Jira
    const rawJiraData = await this.jiraService.getProjectIssues(
      jiraTokenUserId,
      group.jira_project_key,
    );

    // 2. Synthesize input prompt
    const prompt = `You are a professional Business Analyst and System Architect. 
I have a list of Epics, User Stories, and Tasks extracted from a Jira project.
Please generate a comprehensive Software Requirements Specification (SRS) document using Markdown format.
Include sections like: 
1. Introduction (Purpose, Scope)
2. Overall Description (Product Perspective, Features)
3. Specific Requirements (Functional & Non-Functional based on the data below)
4. System Architecture (If any implies exist in tasks)

Raw Jira Data:
${JSON.stringify(rawJiraData)}

Return only the markdown document. Do not add conversational text around it.`;

    // 3. Request Markdown generation via Groq
    const groqClient = this.getGroqClient();
    const chatCompletion = await groqClient.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'llama3-70b-8192',
      temperature: 0.5,
    });

    const markdownOutput =
      chatCompletion.choices[0]?.message?.content || '# Error generating SRS';

    return { markdown: markdownOutput };
  }

  async generateAssignmentReport(groupId: string, userId: string) {
    const group = await this.groupRepository.findOne({
      where: { id: groupId },
      relations: ['members', 'members.user'],
    });
    if (!group) throw new NotFoundException('Group not found');

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

    console.log(
      '[DEBUG generateAssignmentReport] Group Leader ID:',
      leader?.user_id,
      'Token User ID:',
      jiraTokenUserId,
    );

    const rawJiraData = await this.jiraService.getProjectIssues(
      jiraTokenUserId,
      group.jira_project_key,
    );

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
    };
  }

  async generateCommitReport(groupId: string, userId: string) {
    const group = await this.groupRepository.findOne({
      where: { id: groupId },
      relations: ['members', 'members.user'],
    });
    if (!group) throw new NotFoundException('Group not found');

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
      throw new BadRequestException(
        'This group has not linked any Github repositories yet',
      );
    }

    const allStats: any[] = [];

    // Fetch stats for all linked repositories
    for (const repo of repos) {
      try {
        const stats = await this.githubService.getRepoContributorsStats(
          repo.added_by_id,
          repo.repo_owner,
          repo.repo_name,
        );
        allStats.push({
          repository: `${repo.repo_owner}/${repo.repo_name}`,
          contributors: stats,
        });
      } catch (e) {
        // Skip failed ones quietly or log
      }
    }

    return {
      groupName: group.name,
      repositories: allStats,
    };
  }
}
