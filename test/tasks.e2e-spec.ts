import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  INestApplication,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { JwtAuthGuard } from '../src/modules/auth/guards/jwt-auth.guard';
import { TasksController } from '../src/modules/tasks/tasks.controller';
import { TaskWriteRateLimitGuard } from '../src/modules/tasks/guards/task-write-rate-limit.guard';
import { TasksService } from '../src/modules/tasks/tasks.service';

const leaderUser = {
  id: '22222222-2222-2222-2222-222222222222',
  role: 'STUDENT',
};
const memberUser = {
  id: '33333333-3333-3333-3333-333333333333',
  role: 'STUDENT',
};

describe('TasksController (e2e)', () => {
  let app: INestApplication<App>;
  const tasksService = {
    findAll: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  class MockJwtGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
      const req = context.switchToHttp().getRequest();
      req.user =
        req.headers['x-user-scope'] === 'member' ? memberUser : leaderUser;
      return true;
    }
  }

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [TasksController],
      providers: [
        { provide: TasksService, useValue: tasksService },
        {
          provide: TaskWriteRateLimitGuard,
          useValue: { canActivate: () => true },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useClass(MockJwtGuard)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('leader happy path creates task', async () => {
    tasksService.create.mockResolvedValue({
      id: '55555555-5555-5555-5555-555555555555',
      key: null,
      group_id: '11111111-1111-1111-1111-111111111111',
      title: 'Prepare task payload',
      description: null,
      status: 'TODO',
      priority: 'HIGH',
      assignee_name: 'Member A',
      due_at: null,
      created_at: '2026-03-20T10:00:00.000Z',
      updated_at: '2026-03-20T10:00:00.000Z',
    });

    await request(app.getHttpServer())
      .post('/tasks')
      .send({
        group_id: '11111111-1111-1111-1111-111111111111',
        title: 'Prepare task payload',
        priority: 'HIGH',
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body.title).toBe('Prepare task payload');
      });
  });

  it('member forbidden on task write', async () => {
    tasksService.create.mockRejectedValue(
      new ForbiddenException('Only group leaders can manage internal tasks'),
    );

    await request(app.getHttpServer())
      .post('/tasks')
      .set('x-user-scope', 'member')
      .send({
        group_id: '11111111-1111-1111-1111-111111111111',
        title: 'Prepare task payload',
      })
      .expect(403);
  });

  it('rejects assignee outside group', async () => {
    tasksService.create.mockRejectedValue(
      new BadRequestException(
        'Assigned user must be an active member of the same group',
      ),
    );

    await request(app.getHttpServer())
      .post('/tasks')
      .send({
        group_id: '11111111-1111-1111-1111-111111111111',
        title: 'Prepare task payload',
        assignee_id: '99999999-9999-9999-9999-999999999999',
      })
      .expect(400);
  });

  it('passes filter status/search to list route', async () => {
    tasksService.findAll.mockResolvedValue({
      data: [
        {
          id: '55555555-5555-5555-5555-555555555555',
          key: null,
          group_id: '11111111-1111-1111-1111-111111111111',
          title: 'Searchable task',
          description: null,
          status: 'DONE',
          priority: 'MEDIUM',
          assignee_name: null,
          due_at: null,
          created_at: '2026-03-20T10:00:00.000Z',
          updated_at: '2026-03-20T10:00:00.000Z',
        },
      ],
      meta: { total: 1, page: 1, limit: 10, total_pages: 1 },
    });

    await request(app.getHttpServer())
      .get(
        '/tasks?group_id=11111111-1111-1111-1111-111111111111&status=DONE&search=search',
      )
      .expect(200)
      .expect(({ body }) => {
        expect(body.meta.total).toBe(1);
      });

    expect(tasksService.findAll).toHaveBeenCalledWith(
      leaderUser.id,
      expect.objectContaining({
        group_id: '11111111-1111-1111-1111-111111111111',
        status: 'DONE',
        search: 'search',
      }),
    );
  });
});
