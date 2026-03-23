import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  AuthService,
  UserTokenPayloadDto,
  AuthResponse,
  LoginResponse,
} from './auth.service';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { HttpService } from '@nestjs/axios';
import { User, IntegrationToken, IntegrationProvider } from '../../entities';
import { ERROR_MESSAGES } from '../../common/constants';
import * as bcrypt from 'bcrypt';
import { ConflictException, BadRequestException } from '@nestjs/common';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let mockJwtService: jest.Mocked<JwtService>;
  let mockUserRepository: Record<string, jest.Mock>;
  let mockIntegrationTokenRepository: Record<string, jest.Mock>;
  let mockHttpService: jest.Mocked<HttpService>;
  let mockConfigService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    mockJwtService = {
      sign: jest.fn(),
      verify: jest.fn(),
    } as unknown as jest.Mocked<JwtService>;
    mockConfigService = {
      get: jest.fn(),
    } as unknown as jest.Mocked<ConfigService>;
    mockUserRepository = {
      findOne: jest.fn(),
      create: jest.fn((dto) => dto),
      save: jest.fn(),
      update: jest.fn(),
    };
    mockIntegrationTokenRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn((dto) => dto),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    mockHttpService = {
      axiosRef: {
        get: jest.fn(),
        post: jest.fn(),
      },
    } as unknown as jest.Mocked<HttpService>;

    const app: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: getRepositoryToken(IntegrationToken),
          useValue: mockIntegrationTokenRepository,
        },
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = app.get<AuthService>(AuthService);
  });

  describe('initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should have necessary injections', () => {
      expect(service['jwtService']).toBeDefined();
      expect(service['userRepository']).toBeDefined();
      expect(service['integrationTokenRepository']).toBeDefined();
      expect(service['configService']).toBeDefined();
    });
  });

  describe('generateJwtToken', () => {
    it('should generate a JWT token with correct payload', () => {
      const user: UserTokenPayloadDto = {
        id: '1',
        full_name: 'Test User',
        email: 'test1@mail.test',
        student_id: 'S123456',
        role: 'USER',
        created_at: new Date(),
      };
      const expectedPayload = {
        sub: user.id,
        email: user.email,
        role: user.role,
      };
      const expectedToken = 'mocked-jwt-token';

      mockJwtService.sign.mockReturnValue(expectedToken);
      const token = service['generateJwtToken'](user);
      expect(token).toBe(expectedToken);
      const spyJwtSign = jest.spyOn(mockJwtService, 'sign');
      expect(spyJwtSign).toHaveBeenCalledWith(expectedPayload);
    });
  });

  describe('getLinkedAccounts', () => {
    it('should return linked accounts for a user', async () => {
      const userId = '1';
      const mockLinkedAccounts = [
        {
          id: 'la1',
          provider: 'google',
          provider_user_id: 'google-uid-1',
          user_id: userId,
        },
        {
          id: 'la2',
          provider: 'github',
          provider_user_id: 'github-uid-1',
          user_id: userId,
        },
      ];

      mockIntegrationTokenRepository.find.mockResolvedValue(mockLinkedAccounts);

      const linkedAccounts = await service.getLinkedAccounts(userId);
      expect(linkedAccounts).toEqual(mockLinkedAccounts);
      expect(mockIntegrationTokenRepository.find).toHaveBeenCalledWith({
        where: {
          user_id: userId,
          used_for_login: true,
        },
        select: {
          provider: true,
          provider_username: true,
          provider_email: true,
          created_at: true,
        },
      });
    });

    it('should return empty array if no linked accounts found', async () => {
      const userId = '2';
      mockIntegrationTokenRepository.find.mockResolvedValue([]);
      const linkedAccounts = await service.getLinkedAccounts(userId);
      expect(linkedAccounts).toEqual([]);
    });
  });

  describe('handleGitHubCallback', () => {
    beforeEach(() => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'GH_CLIENT_ID') return 'test-client-id';
        if (key === 'GH_CLIENT_SECRET') return 'test-client-secret';
        return undefined;
      });
    });

    it('should throw error if GitHub OAuth is not configured', async () => {
      mockConfigService.get.mockReturnValue(undefined);

      await expect(
        service['handleGitHubCallback']('test_code'),
      ).rejects.toThrow('GitHub OAuth is not configured');
    });

    it('should throw error if fetch access token fails', async () => {
      const spyErrorLog = jest.spyOn(console, 'error').mockImplementation();
      const spyPost = jest.spyOn(mockHttpService.axiosRef, 'post');
      (spyPost as jest.Mock).mockRejectedValue(new Error('Network error'));

      await expect(
        service['handleGitHubCallback']('invalid_code'),
      ).rejects.toThrow('GitHub OAuth failed. Please try again.');

      expect(spyPost).toHaveBeenCalledWith(
        'https://github.com/login/oauth/access_token',
        expect.any(Object),
        expect.any(Object),
      );

      expect(spyErrorLog).toHaveBeenCalledWith(
        '[AuthService - handleGitHubCallback]',
        expect.any(Error),
      );

      spyErrorLog.mockRestore();
    });

    it('should throw error if fetch user profile fails', async () => {
      const spyErrorLog = jest.spyOn(console, 'error').mockImplementation();
      const spyGet = jest.spyOn(mockHttpService.axiosRef, 'get');
      const spyPost = jest.spyOn(mockHttpService.axiosRef, 'post');
      (spyPost as jest.Mock).mockResolvedValue({
        data: {
          access_token: 'valid_access_token',
        },
      });
      (spyGet as jest.Mock).mockRejectedValue(new Error('Network error'));

      await expect(
        service['handleGitHubCallback']('valid_code'),
      ).rejects.toThrow('GitHub OAuth failed. Please try again.');

      expect(spyGet).toHaveBeenCalledWith(
        'https://api.github.com/user',
        expect.any(Object),
      );

      expect(spyErrorLog).toHaveBeenCalledWith(
        '[AuthService - handleGitHubCallback]',
        expect.any(Error),
      );

      spyErrorLog.mockRestore();
    });

    it('should throw error if fetch user emails fails', async () => {
      const spyErrorLog = jest.spyOn(console, 'error').mockImplementation();
      const spyGet = jest.spyOn(mockHttpService.axiosRef, 'get');
      const spyPost = jest.spyOn(mockHttpService.axiosRef, 'post');
      (spyPost as jest.Mock).mockResolvedValue({
        data: {
          access_token: 'valid_access_token',
        },
      });
      (spyGet as jest.Mock)
        .mockResolvedValueOnce({
          data: {
            id: 12345,
            login: 'githubuser',
            name: 'GitHub User',
            email: null,
          },
        })
        .mockRejectedValueOnce(new Error('Network error'));

      await expect(
        service['handleGitHubCallback']('valid_code'),
      ).rejects.toThrow('GitHub OAuth failed. Please try again.');
      expect(spyGet).toHaveBeenCalledWith(
        'https://api.github.com/user/emails',
        expect.any(Object),
      );
      expect(spyErrorLog).toHaveBeenCalledWith(
        '[AuthService - handleGitHubCallback]',
        expect.any(Error),
      );
    });

    it('should successfully handle GitHub callback', async () => {
      const spyGet = jest.spyOn(mockHttpService.axiosRef, 'get');
      const spyPost = jest.spyOn(mockHttpService.axiosRef, 'post');

      (spyPost as jest.Mock).mockResolvedValue({
        data: {
          access_token: 'valid_access_token',
        },
      });

      (spyGet as jest.Mock).mockResolvedValueOnce({
        data: {
          id: 12345,
          login: 'githubuser',
          name: 'GitHub User',
          email: null,
          avatar_url: 'https://avatars.githubusercontent.com/u/12345?v=4',
        },
      });

      (spyGet as jest.Mock).mockResolvedValueOnce({
        data: [
          {
            email: 'test1@mail.test',
            primary: true,
            verified: true,
            visibility: 'public',
          },
        ],
      });

      const mockUser = {
        id: 'user-123',
        email: 'test1@mail.test',
        full_name: 'GitHub User',
        student_id: null,
        role: 'USER',
        avatar_url: 'https://avatars.githubusercontent.com/u/12345?v=4',
        created_at: new Date(),
      };

      const spyFindOrCreate = jest
        .spyOn(service, 'findOrCreateOAuthUser')
        .mockResolvedValue(mockUser as User);

      const user = await service['handleGitHubCallback']('valid_code');

      expect(user).toEqual(mockUser);
      expect(spyFindOrCreate).toHaveBeenCalled();
    });
  });

  describe('handleJiraCallback', () => {
    beforeEach(() => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'JIRA_CLIENT_ID') return 'jira-client-id';
        if (key === 'JIRA_CLIENT_SECRET') return 'jira-client-secret';
        if (key === 'JIRA_CALLBACK_URL')
          return 'https://jihub-toxzx.ondigitalocean.app/api/auth/jira/callback';
        return undefined;
      });
    });

    it('stores Jira token expiry metadata after OAuth callback succeeds', async () => {
      const spyPost = jest.spyOn(mockHttpService.axiosRef, 'post');
      const spyGet = jest.spyOn(mockHttpService.axiosRef, 'get');
      const mockUser = {
        id: 'user-jira-123',
        email: 'jira@mail.test',
        full_name: 'Jira User',
        student_id: null,
        role: 'USER',
        created_at: new Date(),
      };

      (spyPost as jest.Mock).mockResolvedValue({
        data: {
          access_token: 'jira-access-token',
          refresh_token: 'jira-refresh-token',
          expires_in: 3600,
          scope: 'read:jira-work offline_access',
        },
      });

      (spyGet as jest.Mock).mockResolvedValue({
        data: {
          account_id: 'jira-account-1',
          name: 'Jira User',
          email: 'jira@mail.test',
          picture: 'https://example.com/avatar.png',
        },
      });

      jest
        .spyOn(service, 'findOrCreateOAuthUser')
        .mockResolvedValue(mockUser as User);

      await service.handleJiraCallback('jira-code');

      expect(mockIntegrationTokenRepository.update).toHaveBeenCalledWith(
        {
          user_id: mockUser.id,
          provider: IntegrationProvider.JIRA,
        },
        expect.objectContaining({
          scope: 'read:jira-work offline_access',
          token_expires_at: expect.any(Date),
          last_refreshed_at: expect.any(Date),
        }),
      );
    });
  });

  describe('unlinkOAuthAccount', () => {
    it('should unlink an OAuth account successfully', async () => {
      const userId = 'user-123';
      const provider: IntegrationProvider = IntegrationProvider.GITHUB;

      mockIntegrationTokenRepository.findOne.mockResolvedValue({
        id: 'token-123',
        provider: provider,
        provider_user_id: 'github-uid-1',
        user_id: userId,
      });

      mockIntegrationTokenRepository.delete.mockResolvedValue({ affected: 1 });

      await service.unlinkOAuthAccount(userId, provider);
      expect(mockIntegrationTokenRepository.delete).toHaveBeenCalledWith({
        id: 'token-123',
      });
    });

    it('should throw error if trying to unlink non-linked account', async () => {
      const userId = 'user-123';
      const provider: IntegrationProvider = IntegrationProvider.GITHUB;
      mockIntegrationTokenRepository.findOne.mockResolvedValue(null);
      await expect(
        service.unlinkOAuthAccount(userId, provider),
      ).rejects.toThrow(ERROR_MESSAGES.AUTH.ACCOUNT_NOT_LINKED);
    });
  });

  describe('findOrCreateOAuthUser', () => {
    it('should find existing user by OAuth token', async () => {
      const provider: IntegrationProvider = IntegrationProvider.GITHUB;
      const providerUserId = 'github-uid-1';
      const providerEmail = 'test1@mail.test';
      const mockUser = {
        id: 'user-123',
        email: providerEmail,
        full_name: 'Test User',
        student_id: null,
        role: 'USER',
        created_at: new Date(),
      };

      const spyFindOrCreate = jest.spyOn(service, 'findOrCreateOAuthUser');
      (spyFindOrCreate as jest.Mock).mockResolvedValue(mockUser as User);

      mockIntegrationTokenRepository.findOne.mockResolvedValue({
        id: 'token-123',
        provider: provider,
        provider_user_id: providerUserId,
        user_id: mockUser.id,
      });

      mockUserRepository.findOne.mockResolvedValue(mockUser);

      const user = await service.findOrCreateOAuthUser(
        provider,
        {
          id: providerUserId,
          email: providerEmail,
          username: 'Test User',
        },
        'valid_access_token',
      );
      expect(user).toEqual(mockUser);
    });

    it('should create new user if not found by OAuth token', async () => {
      const provider: IntegrationProvider = IntegrationProvider.GITHUB;
      const providerUserId = 'github-uid-2';
      const providerEmail = 'test2@mail.test';
      const mockNewUser = {
        id: 'user-456',
        email: providerEmail,
        full_name: 'New User',
        student_id: null,
        role: 'USER',
        created_at: new Date(),
      };

      // findUserByOAuthProvider returns null
      mockIntegrationTokenRepository.findOne
        .mockResolvedValueOnce(null) // findUserByOAuthProvider
        .mockResolvedValueOnce(null); // linkOAuthAccount check

      // findOne by email returns null
      mockUserRepository.findOne.mockResolvedValue(null);
      mockUserRepository.save.mockResolvedValue(mockNewUser);
      mockIntegrationTokenRepository.save.mockResolvedValue({});

      const user = await service.findOrCreateOAuthUser(
        provider,
        {
          id: providerUserId,
          email: providerEmail,
          username: 'New User',
        },
        'valid_access_token',
      );
      expect(user).toEqual(mockNewUser);
    });
  });

  describe('linkOAuthAccount', () => {
    it('should update existing OAuth link if already linked', async () => {
      const userId = 'user-123';
      const provider: IntegrationProvider = IntegrationProvider.GITHUB;
      const profile = {
        id: 'github-uid-1',
        username: 'githubuser',
        email: 'test1@mail.test',
        displayName: 'GitHub User',
      };
      const accessToken = 'new_access_token';
      const refreshToken = 'new_refresh_token';

      const existingLink = {
        id: 'token-123',
        user_id: userId,
        provider: provider,
        provider_user_id: 'old-github-uid',
        provider_username: 'oldusername',
        provider_email: 'old@mail.test',
        access_token: 'old_access_token',
        refresh_token: 'old_refresh_token',
        used_for_login: true,
        created_at: new Date(),
      };

      const updatedLink = {
        ...existingLink,
        provider_user_id: profile.id,
        provider_username: profile.username,
        provider_email: profile.email,
        access_token: accessToken,
        refresh_token: refreshToken,
        last_refreshed_at: new Date(),
      };

      mockIntegrationTokenRepository.findOne
        .mockResolvedValueOnce(existingLink) // check existing
        .mockResolvedValueOnce(updatedLink); // return after update

      mockIntegrationTokenRepository.update.mockResolvedValue({ affected: 1 });

      const result = await service.linkOAuthAccount(
        userId,
        provider,
        profile,
        accessToken,
        refreshToken,
      );

      expect(mockIntegrationTokenRepository.findOne).toHaveBeenCalledWith({
        where: {
          user_id: userId,
          provider,
        },
      });

      expect(mockIntegrationTokenRepository.update).toHaveBeenCalledWith(
        { id: existingLink.id },
        {
          provider_user_id: profile.id,
          provider_username: profile.username,
          provider_email: profile.email,
          access_token: accessToken,
          refresh_token: refreshToken,
          used_for_login: true,
          last_refreshed_at: expect.any(Date) as Date,
        },
      );

      expect(result).toEqual(updatedLink);
    });

    it('should create new OAuth link if not already linked', async () => {
      const userId = 'user-456';
      const provider: IntegrationProvider = IntegrationProvider.GITHUB;
      const profile = {
        id: 'github-uid-2',
        username: 'newuser',
        email: 'newuser@mail.test',
        displayName: 'New User',
      };
      const accessToken = 'new_access_token';
      const refreshToken = 'new_refresh_token';

      const createdLink = {
        id: 'token-456',
        user_id: userId,
        provider: provider,
        provider_user_id: profile.id,
        provider_username: profile.username,
        provider_email: profile.email,
        access_token: accessToken,
        refresh_token: refreshToken,
        used_for_login: true,
        created_at: new Date(),
      };

      mockIntegrationTokenRepository.findOne.mockResolvedValue(null);
      mockIntegrationTokenRepository.save.mockResolvedValue(createdLink);

      const result = await service.linkOAuthAccount(
        userId,
        provider,
        profile,
        accessToken,
        refreshToken,
      );

      expect(mockIntegrationTokenRepository.findOne).toHaveBeenCalledWith({
        where: {
          user_id: userId,
          provider,
        },
      });

      expect(mockIntegrationTokenRepository.save).toHaveBeenCalled();
      expect(result).toEqual(createdLink);
    });

    it('should handle linking without refresh token', async () => {
      const userId = 'user-789';
      const provider: IntegrationProvider = IntegrationProvider.GITHUB;
      const profile = {
        id: 'github-uid-3',
        username: 'usernorefresh',
        email: 'norefresh@mail.test',
      };
      const accessToken = 'access_token_only';

      const createdLink = {
        id: 'token-789',
        user_id: userId,
        provider: provider,
        provider_user_id: profile.id,
        provider_username: profile.username,
        provider_email: profile.email,
        access_token: accessToken,
        refresh_token: undefined,
        used_for_login: true,
        created_at: new Date(),
      };

      mockIntegrationTokenRepository.findOne.mockResolvedValue(null);
      mockIntegrationTokenRepository.save.mockResolvedValue(createdLink);

      const result = await service.linkOAuthAccount(
        userId,
        provider,
        profile,
        accessToken,
      );

      expect(mockIntegrationTokenRepository.save).toHaveBeenCalled();
      expect(result).toEqual(createdLink);
    });
  });

  describe('findUserByOAuthProvider', () => {
    it('should find integration with user by OAuth provider', async () => {
      const provider: IntegrationProvider = IntegrationProvider.GITHUB;
      const providerId = 'github-uid-123';

      const mockUser = {
        id: 'user-123',
        email: 'test1@mail.test',
        full_name: 'Test User',
        student_id: null,
        role: 'USER',
        created_at: new Date(),
      };

      const mockIntegration = {
        id: 'token-123',
        user_id: mockUser.id,
        provider: provider,
        provider_user_id: providerId,
        provider_username: 'testuser',
        provider_email: 'test1@mail.test',
        access_token: 'access_token',
        refresh_token: 'refresh_token',
        used_for_login: true,
        created_at: new Date(),
        user: mockUser,
      };

      mockIntegrationTokenRepository.findOne.mockResolvedValue(mockIntegration);

      const result = await service.findUserByOAuthProvider(
        provider,
        providerId,
      );

      expect(mockIntegrationTokenRepository.findOne).toHaveBeenCalledWith({
        where: {
          provider,
          provider_user_id: providerId,
        },
        relations: ['user'],
      });

      expect(result).toEqual(mockIntegration);
      expect(result?.user).toEqual(mockUser);
    });

    it('should return null if integration not found', async () => {
      const provider: IntegrationProvider = IntegrationProvider.GITHUB;
      const providerId = 'non-existent-uid';

      mockIntegrationTokenRepository.findOne.mockResolvedValue(null);

      const result = await service.findUserByOAuthProvider(
        provider,
        providerId,
      );

      expect(mockIntegrationTokenRepository.findOne).toHaveBeenCalledWith({
        where: {
          provider,
          provider_user_id: providerId,
        },
        relations: ['user'],
      });

      expect(result).toBeNull();
    });
  });

  describe('register', () => {
    it('should successfully register a new user', async () => {
      const registerDto = {
        email: 'newuser@mail.test',
        password: 'password123',
        fullName: 'New User',
        studentId: 'S123456',
      };

      const hashedPassword = 'hashed_password_123';
      const mockSavedUser = {
        id: 'user-new',
        email: registerDto.email,
        full_name: registerDto.fullName,
        student_id: registerDto.studentId,
        role: 'USER',
        created_at: new Date(),
        password_hash: hashedPassword,
      };

      const expectedToken = 'jwt-token-123';

      mockUserRepository.findOne.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);
      mockUserRepository.save.mockResolvedValue(mockSavedUser);
      mockJwtService.sign.mockReturnValue(expectedToken);

      const result = await service.register(registerDto);

      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { email: registerDto.email },
      });
      expect(bcrypt.hash).toHaveBeenCalledWith(registerDto.password, 10);
      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('access_token');
      expect(result.access_token).toBe(expectedToken);
    });

    it('should throw ConflictException if email already exists', async () => {
      const registerDto = {
        email: 'existing@mail.test',
        password: 'password123',
        fullName: 'Existing User',
        studentId: 'S999999',
      };

      const existingUser = {
        id: 'existing-user-id',
        email: registerDto.email,
      };

      mockUserRepository.findOne.mockResolvedValue(existingUser);

      await expect(service.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
      await expect(service.register(registerDto)).rejects.toThrow(
        ERROR_MESSAGES.AUTH.EMAIL_ALREADY_EXISTS,
      );

      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { email: registerDto.email },
      });
    });
  });

  describe('login', () => {
    it('should successfully login a user', async () => {
      const loginDto = {
        email: 'user@mail.test',
        password: 'password123',
      };

      const mockUser = {
        id: 'user-123',
        email: loginDto.email,
        full_name: 'Test User',
        student_id: 'S123456',
        role: 'USER',
        password_hash: 'hashed_password',
        created_at: new Date(),
        last_login: null,
      };

      const expectedToken = 'jwt-token-456';
      const expectedResponse: LoginResponse = {
        user: {
          id: mockUser.id,
          email: mockUser.email,
          full_name: mockUser.full_name,
          student_id: mockUser.student_id,
          role: mockUser.role,
        },
        access_token: expectedToken,
      };

      const spyValidateUser = jest.spyOn(service, 'validateUser');
      (spyValidateUser as jest.Mock).mockResolvedValue(mockUser);
      mockUserRepository.update.mockResolvedValue({ affected: 1 });
      mockJwtService.sign.mockReturnValue(expectedToken);

      const result = await service.login(loginDto);

      expect(spyValidateUser).toHaveBeenCalledWith(
        loginDto.email,
        loginDto.password,
      );

      expect(mockUserRepository.update).toHaveBeenCalledWith(
        { id: mockUser.id },
        { last_login: expect.any(Date) as Date },
      );

      expect(result).toEqual(expectedResponse);
      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('access_token');
      expect(result.user).not.toHaveProperty('created_at');
    });

    it('should throw BadRequestException if credentials are invalid', async () => {
      const loginDto = {
        email: 'user@mail.test',
        password: 'wrong_password',
      };

      const spyValidateUser = jest.spyOn(service, 'validateUser');
      (spyValidateUser as jest.Mock).mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.login(loginDto)).rejects.toThrow(
        ERROR_MESSAGES.AUTH.INVALID_CREDENTIALS,
      );

      expect(spyValidateUser).toHaveBeenCalledWith(
        loginDto.email,
        loginDto.password,
      );
    });
  });

  describe('validateUser', () => {
    it('should return user if credentials are valid', async () => {
      const email = 'user@mail.test';
      const password = 'password123';
      const mockUser = {
        id: 'user-123',
        email: email,
        password_hash: 'hashed_password',
        full_name: 'Test User',
        student_id: 'S123456',
        role: 'USER',
        created_at: new Date(),
      };

      mockUserRepository.findOne.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.validateUser(email, password);

      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { email },
      });

      expect(bcrypt.compare).toHaveBeenCalledWith(
        password,
        mockUser.password_hash,
      );

      expect(result).toEqual(mockUser);
    });

    it('should return null if user not found', async () => {
      const email = 'nonexistent@mail.test';
      const password = 'password123';

      mockUserRepository.findOne.mockResolvedValue(null);

      const result = await service.validateUser(email, password);

      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { email },
      });

      expect(result).toBeNull();
    });

    it('should return null if user has no password hash (OAuth user)', async () => {
      const email = 'oauth@mail.test';
      const password = 'password123';
      const mockOAuthUser = {
        id: 'user-oauth',
        email: email,
        password_hash: null,
        full_name: 'OAuth User',
        role: 'USER',
      };

      mockUserRepository.findOne.mockResolvedValue(mockOAuthUser);

      const result = await service.validateUser(email, password);

      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { email },
      });

      expect(result).toBeNull();
    });

    it('should return null if password is incorrect', async () => {
      const email = 'user@mail.test';
      const password = 'wrong_password';
      const mockUser = {
        id: 'user-123',
        email: email,
        password_hash: 'hashed_password',
        full_name: 'Test User',
        role: 'USER',
      };

      mockUserRepository.findOne.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await service.validateUser(email, password);

      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { email },
      });

      expect(bcrypt.compare).toHaveBeenCalledWith(
        password,
        mockUser.password_hash,
      );

      expect(result).toBeNull();
    });
  });
});
