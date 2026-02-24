import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { IntegrationProvider } from '../../entities';
import { ERROR_MESSAGES } from '../../common/constants';
import { randomUUID } from 'crypto';
import type { Request, Response } from 'express';
import { RedisService } from '../../redis/redis.service';
import {
  AuthResponse,
  AuthService,
  LinkedAccountResponse,
  LoginResponse,
} from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import {
  OptionalJwtAuthGuard,
  RequestUser,
} from './guards/optional-jwt-auth.guard';

export interface AuthorizedRequest extends Request {
  user: RequestUser;
}

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {}

  // ============ Email/Password Authentication ============

  @Post('register')
  @ApiOperation({ summary: 'Register new user with email and password' })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  async register(@Body() registerDto: RegisterDto): Promise<AuthResponse> {
    return this.authService.register(registerDto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 200,
    description: 'Login successful, returns JWT token',
  })
  @ApiResponse({ status: 400, description: 'Invalid credentials' })
  async login(@Body() loginDto: LoginDto): Promise<LoginResponse> {
    return this.authService.login(loginDto);
  }

  // ============ GitHub OAuth ============

  @Get('github')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({
    summary: 'Initiate GitHub OAuth flow (❌ Do not use "Try it out")',
    description:
      '<b>Note:</b> Do not use the "Try it out" button here. It will fail with a CORS error because it tries to fetch the GitHub login page. <br />👉 <b>Open this URL in a new browser tab instead:</b> <a href="/api/auth/github" target="_blank">/api/auth/github</a>',
  })
  @ApiResponse({ status: 302, description: 'Redirects to GitHub OAuth' })
  async githubAuth(
    @Query('redirect_uri') redirectUri: string,
    @Res() res: Response,
  ) {
    // Validate redirect_uri against allowed origins from environment
    const allowedOrigins = this.configService
      .get<string>('ALLOWED_CORS_ORIGINS')
      ?.split(',') || ['http://localhost:3000', 'http://localhost:5173'];

    if (!redirectUri || !allowedOrigins.includes(redirectUri)) {
      throw new BadRequestException(ERROR_MESSAGES.AUTH.INVALID_REDIRECT_URI);
    }

    // Generate state and store redirect_uri
    const state = randomUUID();
    await this.redisService.setOAuthState(state, redirectUri);

    // Build GitHub OAuth URL with state parameter
    const clientId = this.configService.get<string>('GH_CLIENT_ID');
    const callbackUrl = this.configService.get<string>('GH_CALLBACK_URL', '');
    const scope = 'user:email read:user';

    const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(callbackUrl)}&scope=${scope}&state=${state}`;

    res.redirect(githubAuthUrl);
  }

  @Get('github/callback')
  @ApiOperation({ summary: 'GitHub OAuth callback (internal use)' })
  @ApiResponse({
    status: 302,
    description: 'Sets auth cookie and redirects to frontend',
  })
  async githubCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    // Validate required parameters
    if (!code || code.length === 0 || !state || state.length === 0) {
      throw new BadRequestException(ERROR_MESSAGES.AUTH.MISSING_PARAMETER);
    }

    // Retrieve redirect_uri from Redis using state
    const redirectUri = await this.redisService.getOAuthState(state);

    if (!redirectUri) {
      throw new BadRequestException(ERROR_MESSAGES.AUTH.INVALID_OAUTH_STATE);
    }

    // Delete state from Redis (one-time use)
    await this.redisService.deleteOAuthState(state);

    // Handle GitHub OAuth callback manually (exchange code for user)
    const user = await this.authService.handleGitHubCallback(code);
    const token = this.authService.generateJwtToken(user);

    // Set secure httpOnly cookie
    const isProduction =
      this.configService.get<string>('NODE_ENV') === 'production';
    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // Redirect to the original redirect_uri from Redis
    res.redirect(`${redirectUri}/auth/callback`);
  }

  // ============ Jira OAuth (DISABLED - Requires HTTPS) ============
  // TODO: Enable when domain + HTTPS is configured
  // Jira/Atlassian requires HTTPS callback URLs

  /*
  @Get('jira')
  @ApiOperation({
    summary: 'Initiate Jira/Atlassian OAuth flow (❌ DISABLED - Requires HTTPS)',
    description:
      '<b>Note:</b> Jira OAuth is currently disabled. Atlassian requires HTTPS callback URLs. Please configure a domain with SSL certificate first.',
  })
  @ApiResponse({ status: 501, description: 'Not implemented - requires HTTPS' })
  async jiraAuth() {
    throw new BadRequestException('Jira OAuth requires HTTPS. Please configure domain + SSL first.');
  }

  @Get('jira/callback')
  @ApiOperation({ summary: 'Jira OAuth callback (DISABLED)' })
  @ApiResponse({ status: 501, description: 'Not implemented - requires HTTPS' })
  jiraCallback(@Req() req: Request, @Res() res: Response) {
    throw new BadRequestException('Jira OAuth requires HTTPS. Please configure domain + SSL first.');
  }
  */

  // ============ Account Management ============

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated user profile' })
  @ApiResponse({ status: 200, description: 'Returns user profile' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  // TODO: Fix this endpoint to return proper user data using JWT
  getCurrentUser(@Req() req: Request) {
    return req.user;
  }

  @Get('linked-accounts')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all linked OAuth accounts' })
  @ApiResponse({ status: 200, description: 'Returns list of linked accounts' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getLinkedAccounts(
    @Req() req: AuthorizedRequest,
  ): Promise<LinkedAccountResponse[]> {
    return await this.authService.getLinkedAccounts(req.user.id);
  }

  @Delete('unlink/:provider')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Unlink an OAuth provider' })
  @ApiParam({ name: 'provider', enum: ['GITHUB', 'JIRA'] })
  @ApiResponse({ status: 200, description: 'Provider unlinked successfully' })
  @ApiResponse({ status: 400, description: 'Provider not linked' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async unlinkAccount(
    @Req() req: AuthorizedRequest,
    @Param('provider') provider: string,
  ) {
    if (!['GITHUB', 'JIRA'].includes(provider.toUpperCase())) {
      throw new BadRequestException(ERROR_MESSAGES.AUTH.INVALID_PROVIDER);
    }
    const providerEnum = provider.toUpperCase();
    return await this.authService.unlinkOAuthAccount(
      req.user.id,
      providerEnum as IntegrationProvider,
    );
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout user and clear auth cookie' })
  @ApiResponse({ status: 200, description: 'Logged out successfully' })
  logout(@Res() res: Response) {
    res.clearCookie('auth_token');
    return res.json({ message: 'Logged out successfully' });
  }
}
