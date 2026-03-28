import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Group } from '../../entities/group.entity';
import { ProjectLink } from '../../entities/project-link.entity';
import { GithubService } from '../github/github.service';
import { JiraService } from '../jira/jira.service';
import { ReportService } from './report.service';

describe('ReportService', () => {
  let service: ReportService;
  const groupRepository = {
    findOne: jest.fn(),
    manager: {
      createQueryBuilder: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      }),
    },
  };
  const projectLinkRepository = {
    findOne: jest.fn(),
  };
  const jiraService = {
    getProjectIssues: jest.fn(),
  };
  const githubService = {
    getRepoContributorsStats: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportService,
        { provide: getRepositoryToken(Group), useValue: groupRepository },
        {
          provide: getRepositoryToken(ProjectLink),
          useValue: projectLinkRepository,
        },
        { provide: JiraService, useValue: jiraService },
        { provide: GithubService, useValue: githubService },
      ],
    }).compile();

    service = module.get<ReportService>(ReportService);
  });

  it('returns empty assignments when group has no Jira project key', async () => {
    groupRepository.findOne.mockResolvedValue({
      id: 'group-1',
      name: 'Group Alpha',
      jira_project_key: null,
      members: [],
      created_by_id: 'leader-1',
    });

    const result = await service.generateAssignmentReport('group-1', 'user-1');

    expect(result.totalTasks).toBe(0);
    expect(result.assignments).toEqual([]);
    expect(result.warnings[0]).toContain('has not linked a Jira project');
  });

  it('returns warning instead of throwing when Jira fetch fails', async () => {
    groupRepository.findOne.mockResolvedValue({
      id: 'group-1',
      name: 'Group Alpha',
      jira_project_key: 'SWP',
      members: [],
      created_by_id: 'leader-1',
    });
    jiraService.getProjectIssues.mockRejectedValue(new Error('Token expired'));

    const result = await service.generateAssignmentReport('group-1', 'user-1');

    expect(result.totalTasks).toBe(0);
    expect(result.assignments).toEqual([]);
    expect(result.warnings).toContain('Token expired');
  });
});
