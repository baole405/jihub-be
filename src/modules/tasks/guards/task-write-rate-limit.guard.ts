import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 20;

@Injectable()
export class TaskWriteRateLimitGuard implements CanActivate {
  private static readonly hits = new Map<string, number[]>();
  private readonly logger = new Logger(TaskWriteRateLimitGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id;

    if (!userId) {
      return true;
    }

    const now = Date.now();
    const key = `task-write:${userId}`;
    const existing =
      TaskWriteRateLimitGuard.hits.get(key)?.filter(
        (timestamp) => now - timestamp < WINDOW_MS,
      ) || [];

    if (existing.length >= MAX_REQUESTS) {
      this.logger.warn(
        JSON.stringify({
          event: 'task_write_rate_limited',
          actor_user_id: userId,
        }),
      );
      throw new HttpException(
        'Too many task write requests. Please retry shortly.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    existing.push(now);
    TaskWriteRateLimitGuard.hits.set(key, existing);
    return true;
  }
}
