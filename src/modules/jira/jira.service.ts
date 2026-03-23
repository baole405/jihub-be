import { HttpService } from '@nestjs/axios';
import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { lastValueFrom } from 'rxjs';
import { Repository } from 'typeorm';
import { createIntegrationException } from '../../common/errors/integration-error';
import {
  IntegrationProvider,
  IntegrationToken,
  ProjectLink,
} from '../../entities';

const JIRA_REFRESH_SKEW_MS = 60_000;

interface JiraAccessibleResource {
  id: string;
  scopes: string[];
}

interface JiraTokenRefreshResponse {
  access_token: string;
  expires_in?: number;
  scope?: string;
  refresh_token?: string;
}

interface JiraMyselfResponse {
  accountId: string;
}

interface JiraIssueSearchItem {
  key: string;
  fields?: {
    summary?: string;
    status?: {
      name?: string;
    };
    assignee?: unknown;
    issuetype?: {
      name?: string;
    };
  };
}

interface JiraIssueSearchResponse {
  issues?: JiraIssueSearchItem[];
}

interface JiraCreatedProjectResponse extends Record<string, unknown> {
  id?: string | number;
  projectKey?: string;
}

export interface JiraProject {
  id: string;
  key: string;
  name: string;
  projectTypeKey: string;
  simplified: boolean;
  style: string;
  isPrivate: boolean;
  avatarUrls: {
    '48x48': string;
    '24x24': string;
    '16x16': string;
    '32x32': string;
  };
}

@Injectable()
export class JiraService {
  private readonly logger = new Logger(JiraService.name);

  constructor(
    @InjectRepository(IntegrationToken)
    private readonly integrationTokenRepository: Repository<IntegrationToken>,
    @InjectRepository(ProjectLink)
    private readonly projectLinkRepository: Repository<ProjectLink>,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }

  private getResponseObject(error: unknown) {
    if (!this.isRecord(error)) {
      return undefined;
    }

    const response = error.response;
    return this.isRecord(response) ? response : undefined;
  }

  private extractProviderMessage(error: unknown, fallbackMessage: string) {
    const response = this.getResponseObject(error);
    const data = this.isRecord(response?.data) ? response?.data : undefined;

    const errorMessages = data?.errorMessages;
    if (Array.isArray(errorMessages) && typeof errorMessages[0] === 'string') {
      return errorMessages[0];
    }

    if (typeof data?.message === 'string') {
      return data.message;
    }

    if (typeof data?.error_description === 'string') {
      return data.error_description;
    }

    if (this.isRecord(data) && typeof data.error === 'string') {
      return data.error;
    }

    if (this.isRecord(error) && typeof error.message === 'string') {
      return error.message;
    }

    return fallbackMessage;
  }

  private async getRequiredToken(userId: string) {
    const token = await this.integrationTokenRepository.findOne({
      where: { user_id: userId, provider: IntegrationProvider.JIRA },
    });

    if (!token || !token.access_token) {
      throw createIntegrationException(HttpStatus.BAD_REQUEST, {
        code: 'ACCOUNT_NOT_LINKED',
        provider: IntegrationProvider.JIRA,
        message: 'Jira account is not linked for this user.',
        reconnectRequired: true,
      });
    }

    return token;
  }

  private isUnauthorized(error: unknown) {
    return this.getStatusCode(error) === 401;
  }

  private getStatusCode(error: unknown): number | undefined {
    if (error instanceof HttpException) {
      return error.getStatus();
    }

    const response = this.getResponseObject(error);
    if (typeof response?.status === 'number') {
      return response.status;
    }

    if (this.isRecord(error) && typeof error.getStatus === 'function') {
      const getStatus = error.getStatus as () => unknown;
      const status = getStatus();
      return typeof status === 'number' ? status : undefined;
    }

    return undefined;
  }

  private shouldProactivelyRefresh(token: IntegrationToken) {
    return (
      !!token.refresh_token &&
      !!token.token_expires_at &&
      token.token_expires_at.getTime() <= Date.now() + JIRA_REFRESH_SKEW_MS
    );
  }

  private mapReconnectRequired(userId: string, reason: string): never {
    this.logger.warn(
      JSON.stringify({
        event: 'jira_reconnect_required',
        user_id: userId,
        hint: 'relink_jira_account',
        reason,
      }),
    );

    throw createIntegrationException(HttpStatus.UNAUTHORIZED, {
      code: 'TOKEN_EXPIRED',
      provider: IntegrationProvider.JIRA,
      message:
        'Jira access token expired or could not be refreshed. Please reconnect Jira.',
      reconnectRequired: true,
    });
  }

  private mapJiraError(
    error: unknown,
    userId: string,
    fallbackMessage: string,
  ): never {
    if (error instanceof HttpException) {
      throw error;
    }

    const status = this.getStatusCode(error);

    if (status === 401) {
      this.logger.warn(
        JSON.stringify({
          event: 'jira_token_invalid',
          user_id: userId,
          hint: 'relink_jira_account',
        }),
      );
      throw createIntegrationException(HttpStatus.UNAUTHORIZED, {
        code: 'TOKEN_EXPIRED',
        provider: IntegrationProvider.JIRA,
        message:
          'Jira token expired or is no longer valid. Please reconnect Jira.',
        reconnectRequired: true,
      });
    }

    if (status === 403) {
      this.logger.warn(
        JSON.stringify({
          event: 'jira_scope_invalid',
          user_id: userId,
          hint: 'relink_jira_account_with_required_scopes',
        }),
      );
      throw createIntegrationException(HttpStatus.FORBIDDEN, {
        code: 'INSUFFICIENT_SCOPE',
        provider: IntegrationProvider.JIRA,
        message:
          'Jira access is missing required permissions for this action. Please reconnect Jira with the required scopes.',
        reconnectRequired: true,
      });
    }

    if (status === 404) {
      throw createIntegrationException(HttpStatus.NOT_FOUND, {
        code: 'NOT_FOUND',
        provider: IntegrationProvider.JIRA,
        message: 'The requested Jira resource could not be found.',
      });
    }

    if (status === 429) {
      throw createIntegrationException(HttpStatus.TOO_MANY_REQUESTS, {
        code: 'RATE_LIMITED',
        provider: IntegrationProvider.JIRA,
        message:
          'Jira rate limit reached. Please retry after the provider quota resets.',
        retryable: true,
      });
    }

    throw createIntegrationException(HttpStatus.BAD_REQUEST, {
      code: 'VALIDATION_ERROR',
      provider: IntegrationProvider.JIRA,
      message: fallbackMessage,
      details: {
        providerMessage: this.extractProviderMessage(error, fallbackMessage),
      },
    });
  }

  private async refreshAccessToken(
    userId: string,
    token: IntegrationToken,
  ): Promise<IntegrationToken | null> {
    if (!token.refresh_token) {
      this.logger.warn(
        JSON.stringify({
          event: 'jira_refresh_token_missing',
          user_id: userId,
          hint: 'relink_jira_account',
        }),
      );
      return null;
    }

    const clientId = this.configService.get<string>('JIRA_CLIENT_ID');
    const clientSecret = this.configService.get<string>('JIRA_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      this.logger.error(
        JSON.stringify({
          event: 'jira_refresh_not_configured',
          user_id: userId,
        }),
      );
      return null;
    }

    try {
      const response =
        await this.httpService.axiosRef.post<JiraTokenRefreshResponse>(
          'https://auth.atlassian.com/oauth/token',
          {
            grant_type: 'refresh_token',
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: token.refresh_token,
          },
          {
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
          },
        );

      const refreshed = response.data;
      if (!refreshed?.access_token) {
        return null;
      }

      const nextTokenState = {
        access_token: refreshed.access_token,
        refresh_token: refreshed.refresh_token ?? token.refresh_token,
        token_expires_at: refreshed.expires_in
          ? new Date(Date.now() + refreshed.expires_in * 1000)
          : token.token_expires_at,
        scope: refreshed.scope ?? token.scope,
        last_refreshed_at: new Date(),
      };

      await this.integrationTokenRepository.update(
        { id: token.id },
        nextTokenState,
      );

      this.logger.log(
        JSON.stringify({
          event: 'jira_token_refreshed',
          user_id: userId,
        }),
      );

      return {
        ...token,
        ...nextTokenState,
      };
    } catch (error: unknown) {
      this.logger.warn(
        JSON.stringify({
          event: 'jira_token_refresh_failed',
          user_id: userId,
          hint: 'relink_jira_account',
          status: this.getStatusCode(error) ?? null,
          message: this.extractProviderMessage(
            error,
            'Failed to refresh Jira token',
          ),
        }),
      );
      return null;
    }
  }

  private async ensureFreshToken(userId: string, token: IntegrationToken) {
    if (!this.shouldProactivelyRefresh(token)) {
      return token;
    }

    const refreshed = await this.refreshAccessToken(userId, token);
    if (!refreshed) {
      return this.mapReconnectRequired(
        userId,
        'refresh_failed_before_request_execution',
      );
    }

    return refreshed;
  }

  private selectPreferredResource(resources: JiraAccessibleResource[]) {
    const preferred = resources.find(
      (resource) =>
        resource.scopes?.includes('read:jira-work') ||
        resource.scopes?.includes('read:jira-user'),
    );

    return preferred ?? resources[0];
  }

  private async resolveCloudId(accessToken: string) {
    const response = await this.httpService.axiosRef.get<
      JiraAccessibleResource[]
    >('https://api.atlassian.com/oauth/token/accessible-resources', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });

    const resources = response.data;
    if (!resources?.length) {
      throw createIntegrationException(HttpStatus.NOT_FOUND, {
        code: 'NOT_FOUND',
        provider: IntegrationProvider.JIRA,
        message: 'No accessible Jira site was found for the current account.',
        reconnectRequired: true,
      });
    }

    return this.selectPreferredResource(resources).id;
  }

  private async executeWithJiraContext<T>(
    userId: string,
    fallbackMessage: string,
    executor: (ctx: { accessToken: string; cloudId: string }) => Promise<T>,
  ): Promise<T> {
    const initialToken = await this.ensureFreshToken(
      userId,
      await this.getRequiredToken(userId),
    );

    return this.executeWithResolvedContext(
      userId,
      initialToken,
      fallbackMessage,
      executor,
      false,
    );
  }

  private async executeWithResolvedContext<T>(
    userId: string,
    token: IntegrationToken,
    fallbackMessage: string,
    executor: (ctx: { accessToken: string; cloudId: string }) => Promise<T>,
    hasRetried: boolean,
  ): Promise<T> {
    try {
      const cloudId = await this.resolveCloudId(token.access_token);
      return await executor({ accessToken: token.access_token, cloudId });
    } catch (error: unknown) {
      if (this.isUnauthorized(error) && !hasRetried) {
        const refreshed = await this.refreshAccessToken(userId, token);
        if (!refreshed) {
          return this.mapReconnectRequired(userId, 'refresh_failed_after_401');
        }

        return this.executeWithResolvedContext(
          userId,
          refreshed,
          fallbackMessage,
          executor,
          true,
        );
      }

      return this.mapJiraError(error, userId, fallbackMessage);
    }
  }

  async getProjects(userId: string): Promise<JiraProject[]> {
    return this.executeWithJiraContext(
      userId,
      'Failed to fetch Jira projects.',
      async ({ accessToken, cloudId }) => {
        const response = await lastValueFrom(
          this.httpService.get<{ values: JiraProject[] }>(
            `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/project/search`,
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: 'application/json',
              },
              params: {
                maxResults: 50,
              },
            },
          ),
        );

        return response.data.values || [];
      },
    );
  }

  async getProjectIssues(userId: string, projectId: string): Promise<any[]> {
    return this.executeWithJiraContext(
      userId,
      `Failed to fetch Jira issues for project ${projectId}.`,
      async ({ accessToken, cloudId }) => {
        const response = await lastValueFrom(
          this.httpService.get<JiraIssueSearchResponse>(
            `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/search`,
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: 'application/json',
              },
              params: {
                jql: `project = "${projectId}"`,
                maxResults: 100,
              },
            },
          ),
        );

        const issues = response.data.issues || [];
        return issues.map((issue) => ({
          key: issue.key,
          summary: issue.fields?.summary,
          status: issue.fields?.status?.name,
          assignee: issue.fields?.assignee,
          issueType: issue.fields?.issuetype?.name,
        }));
      },
    );
  }

  async linkProject(
    userId: string,
    githubRepoFullName: string,
    jiraProjectId: string,
  ) {
    const existingLink = await this.projectLinkRepository.findOne({
      where: {
        user_id: userId,
        github_repo_full_name: githubRepoFullName,
      },
    });

    if (existingLink) {
      existingLink.jira_project_id = jiraProjectId;
      await this.projectLinkRepository.save(existingLink);
      return existingLink;
    }

    const newLink = this.projectLinkRepository.create({
      user_id: userId,
      github_repo_full_name: githubRepoFullName,
      jira_project_id: jiraProjectId,
    });

    return this.projectLinkRepository.save(newLink);
  }

  async createProject(
    userId: string,
    projectName: string,
    projectKey: string,
  ): Promise<JiraCreatedProjectResponse> {
    return this.executeWithJiraContext(
      userId,
      'Failed to create Jira project.',
      async ({ accessToken, cloudId }) => {
        const meResponse = await lastValueFrom(
          this.httpService.get<JiraMyselfResponse>(
            `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/myself`,
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: 'application/json',
              },
            },
          ),
        );
        const leadAccountId = meResponse.data.accountId;

        const response = await lastValueFrom(
          this.httpService.post<JiraCreatedProjectResponse>(
            `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/project`,
            {
              key: projectKey.substring(0, 10).toUpperCase(),
              name: projectName,
              projectTypeKey: 'software',
              projectTemplateKey:
                'com.pyxis.greenhopper.jira:gh-simplified-kanban-classic',
              description:
                'Created automatically by the Group Management System',
              leadAccountId,
            },
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: 'application/json',
                'Content-Type': 'application/json',
              },
            },
          ),
        );

        return response.data;
      },
    );
  }

  async validateProjectAccess(userId: string, projectKey: string) {
    return this.executeWithJiraContext(
      userId,
      `Failed to validate Jira project key ${projectKey}.`,
      async ({ accessToken, cloudId }) => {
        const response = await lastValueFrom(
          this.httpService.get<JiraProject>(
            `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/project/${encodeURIComponent(projectKey)}`,
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: 'application/json',
              },
            },
          ),
        );

        return response.data;
      },
    );
  }
}
