import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService, AuthResponse, LoginResponse } from './auth.service';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../redis/redis.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ConflictException, BadRequestException } from '@nestjs/common';
import { ERROR_MESSAGES } from '../../common/constants';

describe('AuthController', () => {
  let authController: AuthController;
  let mockAuthService: jest.Mocked<AuthService>;
  let mockConfigService: jest.Mocked<ConfigService>;
  let mockRedisService: jest.Mocked<RedisService>;

  beforeEach(async () => {
    mockAuthService = {
      register: jest.fn(),
      login: jest.fn(),
      handleGitHubCallback: jest.fn(),
      generateJwtToken: jest.fn(),
      getLinkedAccounts: jest.fn(),
      unlinkOAuthAccount: jest.fn(),
    } as unknown as jest.Mocked<AuthService>;
    mockConfigService = {
      get: jest.fn(),
    } as unknown as jest.Mocked<ConfigService>;
    mockRedisService = {
      setOAuthState: jest.fn(),
      getOAuthState: jest.fn(),
      deleteOAuthState: jest.fn(),
    } as unknown as jest.Mocked<RedisService>;
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: RedisService, useValue: mockRedisService },
      ],
    }).compile();
    authController = app.get<AuthController>(AuthController);
  });

  describe('register', () => {
    it('should successfully register a new user', async () => {
      const spyRegister = jest.spyOn(mockAuthService, 'register');
      const registerDto: RegisterDto = {
        email: 'newuser@mail.test',
        password: 'password123',
        fullName: 'New User',
        studentId: 'S123456',
      };

      const mockResponse: AuthResponse = {
        user: {
          id: 'user-123',
          email: registerDto.email,
          full_name: registerDto.fullName,
          student_id: registerDto.studentId as string,
          role: 'USER',
          created_at: new Date(),
        },
        access_token: 'jwt-token-123',
      };

      mockAuthService.register.mockResolvedValue(mockResponse);

      const result = await authController.register(registerDto);

      expect(spyRegister).toHaveBeenCalledWith(registerDto);
      expect(spyRegister).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockResponse);
    });

    it('should throw ConflictException if email already exists', async () => {
      const spyRegister = jest.spyOn(mockAuthService, 'register');
      const registerDto: RegisterDto = {
        email: 'existing@mail.test',
        password: 'password123',
        fullName: 'Existing User',
        studentId: 'S999999',
      };

      mockAuthService.register.mockRejectedValue(
        new ConflictException(ERROR_MESSAGES.AUTH.EMAIL_ALREADY_EXISTS),
      );

      await expect(authController.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
      await expect(authController.register(registerDto)).rejects.toThrow(
        ERROR_MESSAGES.AUTH.EMAIL_ALREADY_EXISTS,
      );

      expect(spyRegister).toHaveBeenCalledWith(registerDto);
    });
  });

  describe('login', () => {
    it('should successfully login a user', async () => {
      const spyLogin = jest.spyOn(mockAuthService, 'login');
      const loginDto: LoginDto = {
        email: 'user@mail.test',
        password: 'password123',
      };

      const mockResponse: LoginResponse = {
        user: {
          id: 'user-123',
          email: loginDto.email,
          full_name: 'Test User',
          student_id: 'S123456',
          role: 'USER',
        },
        access_token: 'jwt-token-456',
      };

      mockAuthService.login.mockResolvedValue(mockResponse);

      const result = await authController.login(loginDto);

      expect(spyLogin).toHaveBeenCalledWith(loginDto);
      expect(spyLogin).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockResponse);
    });

    it('should throw BadRequestException if credentials are invalid', async () => {
      const spyLogin = jest.spyOn(mockAuthService, 'login');
      const loginDto: LoginDto = {
        email: 'user@mail.test',
        password: 'wrong_password',
      };

      mockAuthService.login.mockRejectedValue(
        new BadRequestException(ERROR_MESSAGES.AUTH.INVALID_CREDENTIALS),
      );

      await expect(authController.login(loginDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(authController.login(loginDto)).rejects.toThrow(
        ERROR_MESSAGES.AUTH.INVALID_CREDENTIALS,
      );

      expect(spyLogin).toHaveBeenCalledWith(loginDto);
    });

    it('should return user object and access token on successful login', async () => {
      const loginDto: LoginDto = {
        email: 'admin@mail.test',
        password: 'admin123',
      };

      const mockResponse: LoginResponse = {
        user: {
          id: 'admin-1',
          email: loginDto.email,
          full_name: 'Admin User',
          student_id: null,
          role: 'ADMIN',
        },
        access_token: 'admin-jwt-token',
      };

      mockAuthService.login.mockResolvedValue(mockResponse);

      const result = await authController.login(loginDto);

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('access_token');
      expect(result.user).not.toHaveProperty('password');
      expect(result.user.email).toBe(loginDto.email);
      expect(result.access_token).toBe('admin-jwt-token');
    });
  });
});
