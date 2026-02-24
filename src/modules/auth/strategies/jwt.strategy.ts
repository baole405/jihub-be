import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExtractJwt, Strategy, StrategyOptions } from 'passport-jwt';
import { User } from '../../../entities';
import { ERROR_MESSAGES } from '../../../common/constants';
import { Request } from 'express';

export interface JwtPayload {
  sub: string; // User ID
  email: string;
  role: string;
  iat?: number; // Issued at
  exp?: number; // Expiration time
}

export interface ValidatedUser {
  id: string;
  email: string;
  full_name: string | null;
  student_id: string | null;
  role: string;
  avatar_url: string | null;
  primary_provider: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {
    const strategyOptions: StrategyOptions = {
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (request: Request): string | null => {
          const token = request?.cookies?.['auth_token'] as unknown;
          return typeof token === 'string' ? token : null;
        },
        (request: Request): string | null => {
          const token = request?.query?.['token'];
          return typeof token === 'string' ? token : null;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET', 'your-secret-key'),
    };

    super(strategyOptions);
  }

  async validate(payload: JwtPayload): Promise<ValidatedUser> {
    if (!payload.sub || !payload.email) {
      throw new UnauthorizedException(
        ERROR_MESSAGES.AUTH.INVALID_TOKEN_PAYLOAD,
      );
    }

    const user = await this.userRepository.findOne({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        full_name: true,
        student_id: true,
        role: true,
        avatar_url: true,
        primary_provider: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException(ERROR_MESSAGES.AUTH.USER_NOT_FOUND);
    }

    return user;
  }
}
