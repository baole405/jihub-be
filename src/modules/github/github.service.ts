import { HttpService } from '@nestjs/axios';
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { lastValueFrom } from 'rxjs';
import { Repository } from 'typeorm';
import { IntegrationProvider, IntegrationToken } from '../../entities';

interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  html_url: string;
  updated_at: string;
}

interface GitHubContributorStats {
  author: {
    login: string;
    id: number;
    avatar_url: string;
    html_url: string;
  };
  total: number;
  weeks: {
    w: number;
    a: number;
    d: number;
    c: number;
  }[];
}

interface GitHubCommit {
  sha: string;
  commit: {
    author: {
      name: string;
      email: string;
      date: string;
    };
    message: string;
  };
  author?: {
    login: string;
    id: number;
    avatar_url: string;
    html_url: string;
  };
}

@Injectable()
export class GithubService {
  constructor(
    @InjectRepository(IntegrationToken)
    private integrationTokenRepository: Repository<IntegrationToken>,
    private httpService: HttpService,
  ) {}

  async getUserRepositories(userId: string) {
    const token = await this.integrationTokenRepository.findOne({
      where: { user_id: userId, provider: IntegrationProvider.GITHUB },
    });

    if (!token || !token.access_token) {
      throw new BadRequestException(
        'GitHub account is not linked for this user',
      );
    }

    try {
      const response = await lastValueFrom(
        this.httpService.get<GitHubRepo[]>(
          'https://api.github.com/user/repos',
          {
            headers: {
              Authorization: `Bearer ${token.access_token}`,
              Accept: 'application/vnd.github.v3+json',
            },
            params: {
              per_page: 100,
              sort: 'updated',
            },
          },
        ),
      );

      const repos = response.data;
      return {
        total_repos: repos.length,
        repositories: repos.map((r) => ({
          id: r.id,
          name: r.name,
          full_name: r.full_name,
          private: r.private,
          html_url: r.html_url,
          updated_at: r.updated_at,
        })),
      };
    } catch (error: any) {
      console.error('GitHub API error:', error.message);
      if (
        error.response?.status === 401 ||
        error.response?.status === 403 ||
        error.response?.status === 404
      ) {
        await this.integrationTokenRepository.delete({
          user_id: userId,
          provider: IntegrationProvider.GITHUB,
        });
        throw new BadRequestException(
          'GitHub token expired or invalid scopes. Please re-link your GitHub account.',
        );
      }
      throw new BadRequestException(
        'Failed to fetch repositories from GitHub APIs',
      );
    }
  }
  async getRepoContributorsStats(userId: string, owner: string, repo: string) {
    const token = await this.integrationTokenRepository.findOne({
      where: { user_id: userId, provider: IntegrationProvider.GITHUB },
    });

    if (!token || !token.access_token) {
      throw new BadRequestException(
        'GitHub account is not linked for this user',
      );
    }

    try {
      let statsResponse: GitHubContributorStats[] = [];
      let retries = 0;
      const maxRetries = 3;

      while (retries < maxRetries) {
        const response = await lastValueFrom(
          this.httpService.get<GitHubContributorStats[]>(
            `https://api.github.com/repos/${owner}/${repo}/stats/contributors`,
            {
              headers: {
                Authorization: `Bearer ${token.access_token}`,
                Accept: 'application/vnd.github.v3+json',
              },
            },
          ),
        );

        // GitHub API returns 202 if compiling stats. We should wait and retry.
        if (response.status === 202) {
          retries++;
          // Wait 2 seconds before retrying
          await new Promise((resolve) => setTimeout(resolve, 2000));
          continue;
        }

        statsResponse = Array.isArray(response.data) ? response.data : [];
        break;
      }

      return statsResponse.map((stat) => {
        const totalAdditions = stat.weeks.reduce((sum, w) => sum + w.a, 0);
        const totalDeletions = stat.weeks.reduce((sum, w) => sum + w.d, 0);

        return {
          author: stat.author?.login || 'Unknown',
          developer_id: stat.author?.id,
          avatar_url: stat.author?.avatar_url,
          commits: stat.total,
          lines_added: totalAdditions,
          lines_deleted: totalDeletions,
          net_change: totalAdditions - totalDeletions,
        };
      });
    } catch (error: any) {
      console.error(
        `GitHub API error fetching stats for ${owner}/${repo}:`,
        error.message,
      );
      if (error.response?.status === 401 || error.response?.status === 403) {
        await this.integrationTokenRepository.delete({
          user_id: userId,
          provider: IntegrationProvider.GITHUB,
        });
        throw new BadRequestException(
          'GitHub token expired or invalid scopes. Please re-link your GitHub account.',
        );
      }
      throw new BadRequestException(
        'Failed to fetch contributor stats from GitHub API',
      );
    }
  }

  async getRepoCommits(userId: string, owner: string, repo: string) {
    const token = await this.integrationTokenRepository.findOne({
      where: { user_id: userId, provider: IntegrationProvider.GITHUB },
    });

    if (!token || !token.access_token) {
      throw new BadRequestException(
        'GitHub account is not linked for this user',
      );
    }

    try {
      const response = await lastValueFrom(
        this.httpService.get<GitHubCommit[]>(
          `https://api.github.com/repos/${owner}/${repo}/commits`,
          {
            headers: {
              Authorization: `Bearer ${token.access_token}`,
              Accept: 'application/vnd.github.v3+json',
            },
            params: {
              per_page: 100, // Fetch up to 100 recent commits for the timeline
            },
          },
        ),
      );

      return response.data.map((item) => ({
        sha: item.sha,
        author: item.author?.login || item.commit.author.name,
        date: item.commit.author.date,
        message: item.commit.message,
        avatar_url: item.author?.avatar_url,
      }));
    } catch (error: any) {
      console.error(
        `GitHub API error fetching commits for ${owner}/${repo}:`,
        error.message,
      );
      if (error.response?.status === 401 || error.response?.status === 403) {
        await this.integrationTokenRepository.delete({
          user_id: userId,
          provider: IntegrationProvider.GITHUB,
        });
        throw new BadRequestException(
          'GitHub token expired or invalid scopes. Please re-link your GitHub account.',
        );
      }
      throw new BadRequestException('Failed to fetch commits from GitHub API');
    }
  }

  async createRepository(
    userId: string,
    repoName: string,
    description: string,
  ) {
    const token = await this.integrationTokenRepository.findOne({
      where: { user_id: userId, provider: IntegrationProvider.GITHUB },
    });

    if (!token || !token.access_token) {
      throw new BadRequestException(
        'GitHub account is not linked for this user',
      );
    }

    try {
      const response = await lastValueFrom(
        this.httpService.post(
          'https://api.github.com/user/repos',
          {
            name: repoName,
            description,
            private: true,
            auto_init: true, // Generate a quick README
          },
          {
            headers: {
              Authorization: `Bearer ${token.access_token}`,
              Accept: 'application/vnd.github.v3+json',
            },
          },
        ),
      );

      return response.data;
    } catch (error: any) {
      console.error(
        'GitHub API error creating repository:',
        error?.response?.data || error.message,
      );
      throw new BadRequestException(
        'Failed to create repository on GitHub: ' +
          (error?.response?.data?.message || error.message),
      );
    }
  }

  async addCollaborator(
    userId: string,
    owner: string,
    repoName: string,
    targetGithubUsername: string,
  ) {
    const token = await this.integrationTokenRepository.findOne({
      where: { user_id: userId, provider: IntegrationProvider.GITHUB },
    });

    if (!token || !token.access_token) {
      throw new BadRequestException(
        'GitHub account is not linked for this user',
      );
    }

    try {
      const response = await lastValueFrom(
        this.httpService.put(
          `https://api.github.com/repos/${owner}/${repoName}/collaborators/${targetGithubUsername}`,
          { permission: 'push' },
          {
            headers: {
              Authorization: `Bearer ${token.access_token}`,
              Accept: 'application/vnd.github.v3+json',
            },
          },
        ),
      );
      return response.data;
    } catch (error: any) {
      console.error(
        'GitHub API error adding collaborator:',
        error?.response?.data || error.message,
      );
      // It's okay if it fails (maybe the user didn't exist or already invited)
      return null;
    }
  }
}
