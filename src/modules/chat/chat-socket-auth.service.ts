import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Socket } from 'socket.io';
import { Repository } from 'typeorm';
import { ERROR_MESSAGES } from '../../common/constants';
import { User } from '../../entities';

export interface ChatSocketUser {
  id: string;
  email: string;
  full_name: string | null;
  student_id: string | null;
  role: string;
  avatar_url: string | null;
  primary_provider: string;
}

@Injectable()
export class ChatSocketAuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async authenticateSocket(socket: Socket): Promise<ChatSocketUser> {
    const rawToken = this.extractToken(socket);
    if (!rawToken) {
      throw new UnauthorizedException(
        ERROR_MESSAGES.AUTH.INVALID_TOKEN_PAYLOAD,
      );
    }

    const payload = await this.jwtService.verifyAsync<{
      sub: string;
      email: string;
    }>(rawToken, {
      secret: this.configService.getOrThrow<string>('JWT_SECRET'),
    });

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

  private extractToken(socket: Socket) {
    const authToken = socket.handshake.auth?.token;
    if (typeof authToken === 'string' && authToken.trim().length > 0) {
      return authToken.trim();
    }

    const header = socket.handshake.headers.authorization;
    if (typeof header === 'string' && header.startsWith('Bearer ')) {
      return header.slice(7).trim();
    }

    const queryToken = socket.handshake.query?.token;
    if (typeof queryToken === 'string' && queryToken.trim().length > 0) {
      return queryToken.trim();
    }

    return null;
  }
}
