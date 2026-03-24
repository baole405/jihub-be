import {
  CanActivate,
  ExecutionContext,
  INestApplication,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import {
  Class,
  ClassMembership,
  Group,
  GroupMembership,
  GroupRepository,
  GroupReview,
  ImportBatch,
  ImportRowLog,
  Semester,
  SemesterWeekAuditLog,
  Task,
  User,
} from '../src/entities';
import { JwtAuthGuard } from '../src/modules/auth/guards/jwt-auth.guard';
import { GithubService } from '../src/modules/github/github.service';
import { RolesGuard } from '../src/modules/auth/guards/roles.guard';
import { SemesterGovernanceController } from '../src/modules/semester/semester-governance.controller';
import { SemesterService } from '../src/modules/semester/semester.service';

const adminUser = {
  id: '11111111-1111-1111-1111-111111111111',
  role: 'ADMIN',
};

const lecturerUser = {
  id: '22222222-2222-2222-2222-222222222222',
  role: 'LECTURER',
};

const studentUser = {
  id: '33333333-3333-3333-3333-333333333333',
  role: 'STUDENT',
};

function createMockRepository() {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn((dto) => dto),
    save: jest.fn(),
    update: jest.fn(),
    insert: jest.fn(),
  };
}

describe('SemesterGovernanceController (e2e)', () => {
  let app: INestApplication<App>;
  let semesterRepo: ReturnType<typeof createMockRepository>;
  let classRepo: ReturnType<typeof createMockRepository>;
  let classMembershipRepo: ReturnType<typeof createMockRepository>;
  let groupRepo: ReturnType<typeof createMockRepository>;
  let groupMembershipRepo: ReturnType<typeof createMockRepository>;
  let groupRepoLinkRepo: ReturnType<typeof createMockRepository>;
  let groupReviewRepo: ReturnType<typeof createMockRepository>;
  let taskRepo: ReturnType<typeof createMockRepository>;
  let weekAuditRepo: ReturnType<typeof createMockRepository>;

  let activeSemester: any;

  class MockJwtGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
      const req = context.switchToHttp().getRequest();
      const scope = req.headers['x-user-role'];
      req.user =
        scope === 'admin'
          ? adminUser
          : scope === 'student'
            ? studentUser
            : lecturerUser;
      return true;
    }
  }

  beforeEach(async () => {
    activeSemester = {
      id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      code: 'SP26',
      name: 'Spring 2026',
      status: 'ACTIVE',
      current_week: 1,
      start_date: '2026-01-01',
      end_date: '2026-05-01',
    };

    semesterRepo = createMockRepository();
    classRepo = createMockRepository();
    classMembershipRepo = createMockRepository();
    groupRepo = createMockRepository();
    groupMembershipRepo = createMockRepository();
    groupRepoLinkRepo = createMockRepository();
    groupReviewRepo = createMockRepository();
    taskRepo = createMockRepository();
    weekAuditRepo = createMockRepository();

    const importBatchRepo = createMockRepository();
    const importRowLogRepo = createMockRepository();
    const userRepo = createMockRepository();
    const githubService = {
      getRepoCommits: jest.fn().mockResolvedValue([]),
    };

    semesterRepo.findOne.mockImplementation(async (options?: any) => {
      const where = options?.where;

      if (where?.status === 'ACTIVE') {
        return activeSemester;
      }

      if (where?.status === 'UPCOMING') {
        return null;
      }

      if (where?.id === activeSemester.id) {
        return activeSemester;
      }

      return null;
    });

    semesterRepo.save.mockImplementation(async (entity) => {
      activeSemester = {
        ...activeSemester,
        ...entity,
      };
      return activeSemester;
    });

    weekAuditRepo.save.mockImplementation(async (entity) => ({
      id: 'audit-1',
      ...entity,
    }));

    classRepo.find.mockImplementation(async (options?: any) => {
      if (options?.where?.semester === 'SP26') {
        return [
          {
            id: 'class-1',
            code: 'SWP391',
            name: 'Software Project',
            semester: 'SP26',
            lecturer_id: lecturerUser.id,
            max_students_per_group: 6,
          },
        ];
      }

      return [];
    });

    classMembershipRepo.find.mockImplementation(async (options?: any) => {
      if (options?.where?.class_id) {
        return [
          { class_id: 'class-1', user_id: 'student-a' },
          { class_id: 'class-1', user_id: 'student-b' },
        ];
      }

      if (options?.where?.user_id === studentUser.id) {
        return [
          {
            class: {
              id: 'class-1',
              code: 'SWP391',
              name: 'Software Project',
              semester: 'SP26',
            },
          },
          {
            class: {
              id: 'class-2',
              code: 'SWR302',
              name: 'Mobile Project',
              semester: 'SP26',
            },
          },
        ];
      }

      return [];
    });

    groupRepo.find.mockResolvedValue([
      {
        id: 'group-1',
        class_id: 'class-1',
        name: 'Group 1',
        topic_id: 'topic-1',
        project_name: 'Topic One',
        topic: { id: 'topic-1', name: 'Topic One' },
      },
      {
        id: 'group-2',
        class_id: 'class-1',
        name: 'Group 2',
        topic_id: null,
        project_name: null,
        topic: null,
      },
    ]);

    groupMembershipRepo.find.mockImplementation(async (options?: any) => {
      if (options?.where?.group_id) {
        return [{ group_id: 'group-1', user_id: 'student-a' }];
      }

      if (options?.where?.user_id === studentUser.id) {
        return [
          {
            group: {
              id: 'group-1',
              class_id: 'class-1',
              name: 'Group 1',
              topic_id: null,
              project_name: null,
              topic: null,
              class: {
                id: 'class-1',
                semester: 'SP26',
              },
            },
          },
        ];
      }

      return [];
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [SemesterGovernanceController],
      providers: [
        SemesterService,
        RolesGuard,
        Reflector,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              switch (key) {
                case 'DEMO_WEEK_OVERRIDE_ENABLED':
                  return 'true';
                case 'DEMO_WEEK_OVERRIDE_ALLOWED_ROLES':
                  return 'ADMIN';
                default:
                  return undefined;
              }
            }),
          },
        },
        { provide: getRepositoryToken(Semester), useValue: semesterRepo },
        { provide: getRepositoryToken(ImportBatch), useValue: importBatchRepo },
        {
          provide: getRepositoryToken(ImportRowLog),
          useValue: importRowLogRepo,
        },
        { provide: getRepositoryToken(Class), useValue: classRepo },
        {
          provide: getRepositoryToken(ClassMembership),
          useValue: classMembershipRepo,
        },
        { provide: getRepositoryToken(Group), useValue: groupRepo },
        {
          provide: getRepositoryToken(GroupMembership),
          useValue: groupMembershipRepo,
        },
        {
          provide: getRepositoryToken(GroupRepository),
          useValue: groupRepoLinkRepo,
        },
        {
          provide: getRepositoryToken(GroupReview),
          useValue: groupReviewRepo,
        },
        { provide: getRepositoryToken(Task), useValue: taskRepo },
        {
          provide: getRepositoryToken(SemesterWeekAuditLog),
          useValue: weekAuditRepo,
        },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: GithubService, useValue: githubService },
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

  it('returns current week context for authenticated student', async () => {
    await request(app.getHttpServer())
      .get('/semesters/current-week')
      .set('x-user-role', 'student')
      .expect(200)
      .expect(({ body }) => {
        expect(body.semester.code).toBe('SP26');
        expect(body.semester.current_week).toBe(1);
      });
  });

  it('allows admin to override current week and records audit', async () => {
    await request(app.getHttpServer())
      .patch(`/semesters/${activeSemester.id}/current-week`)
      .set('x-user-role', 'admin')
      .send({ current_week: 2 })
      .expect(200)
      .expect(({ body }) => {
        expect(body.audit_recorded).toBe(true);
        expect(body.semester.current_week).toBe(2);
      });

    expect(weekAuditRepo.save).toHaveBeenCalled();
  });

  it('forbids non-admin week override', async () => {
    await request(app.getHttpServer())
      .patch(`/semesters/${activeSemester.id}/current-week`)
      .set('x-user-role', 'lecturer')
      .send({ current_week: 2 })
      .expect(403);
  });

  it('allows lecturer to read compliance summary and blocks student', async () => {
    await request(app.getHttpServer())
      .get('/semesters/current/compliance/lecturer-summary')
      .set('x-user-role', 'lecturer')
      .expect(200)
      .expect(({ body }) => {
        expect(body.summary.students_without_group_total).toBe(1);
        expect(body.summary.groups_without_topic_total).toBe(1);
      });

    await request(app.getHttpServer())
      .get('/semesters/current/compliance/lecturer-summary')
      .set('x-user-role', 'student')
      .expect(403);
  });

  it('returns week-based warnings for student', async () => {
    activeSemester.current_week = 2;

    await request(app.getHttpServer())
      .get('/semesters/current/compliance/student-warning')
      .set('x-user-role', 'student')
      .expect(200)
      .expect(({ body }) => {
        expect(body.warnings).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ code: 'WEEK2_TOPIC_NOT_FINALIZED' }),
            expect.objectContaining({ code: 'WEEK1_NO_GROUP' }),
          ]),
        );
      });
  });
});
