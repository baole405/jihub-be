import { Test, TestingModule } from '@nestjs/testing';
import { ReviewMilestoneCode, Role } from '../../common/enums';
import { SemesterGovernanceController } from './semester-governance.controller';
import { SemesterService } from './semester.service';

describe('SemesterGovernanceController', () => {
  let controller: SemesterGovernanceController;
  let semesterService: {
    getCurrentWeek: jest.Mock;
    getCurrentReviewMilestone: jest.Mock;
    setCurrentWeek: jest.Mock;
    getLecturerComplianceSummary: jest.Mock;
    getStudentWeeklyWarnings: jest.Mock;
    getLecturerReviewSummary: jest.Mock;
    listReviewSessions: jest.Mock;
    listGroupReviewSessions: jest.Mock;
    listGroupReviewSessionHistory: jest.Mock;
    createReviewSession: jest.Mock;
    updateReviewSession: jest.Mock;
    deleteReviewSession: jest.Mock;
    getStudentReviewStatus: jest.Mock;
    upsertCurrentGroupReview: jest.Mock;
    publishMilestoneReviews: jest.Mock;
    getStudentPublishedScores: jest.Mock;
  };

  beforeEach(async () => {
    semesterService = {
      getCurrentWeek: jest.fn(),
      getCurrentReviewMilestone: jest.fn(),
      setCurrentWeek: jest.fn(),
      getLecturerComplianceSummary: jest.fn(),
      getStudentWeeklyWarnings: jest.fn(),
      getLecturerReviewSummary: jest.fn(),
      listReviewSessions: jest.fn(),
      listGroupReviewSessions: jest.fn(),
      listGroupReviewSessionHistory: jest.fn(),
      createReviewSession: jest.fn(),
      updateReviewSession: jest.fn(),
      deleteReviewSession: jest.fn(),
      getStudentReviewStatus: jest.fn(),
      upsertCurrentGroupReview: jest.fn(),
      publishMilestoneReviews: jest.fn(),
      getStudentPublishedScores: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SemesterGovernanceController],
      providers: [{ provide: SemesterService, useValue: semesterService }],
    }).compile();

    controller = module.get<SemesterGovernanceController>(
      SemesterGovernanceController,
    );
  });

  it('delegates current review milestone lookup', async () => {
    semesterService.getCurrentReviewMilestone.mockResolvedValue({
      semester: { id: 'semester-1' },
      milestone: { code: 'REVIEW_1' },
    });

    await expect(controller.getCurrentReviewMilestone()).resolves.toEqual({
      semester: { id: 'semester-1' },
      milestone: { code: 'REVIEW_1' },
    });
    expect(semesterService.getCurrentReviewMilestone).toHaveBeenCalled();
  });

  it('delegates lecturer review summary lookup', async () => {
    semesterService.getLecturerReviewSummary.mockResolvedValue({
      classes: [],
    });

    await controller.getLecturerReviewSummary(
      {
        user: { id: 'lecturer-1', role: Role.LECTURER },
      } as any,
      'class-1',
    );

    expect(semesterService.getLecturerReviewSummary).toHaveBeenCalledWith(
      'lecturer-1',
      Role.LECTURER,
      'class-1',
    );
  });

  it('delegates student warning lookup with caller role', async () => {
    semesterService.getStudentWeeklyWarnings.mockResolvedValue({
      semester: null,
      warnings: [],
      classes: [],
    });

    await controller.getStudentWarnings({
      user: { id: 'student-1', role: Role.STUDENT },
    } as any);

    expect(semesterService.getStudentWeeklyWarnings).toHaveBeenCalledWith(
      'student-1',
      Role.STUDENT,
    );
  });

  it('delegates current group review upsert with caller identity', async () => {
    semesterService.upsertCurrentGroupReview.mockResolvedValue({
      group: { group_id: 'group-1' },
    });

    await controller.upsertCurrentGroupReview(
      'group-1',
      {
        user: { id: 'admin-1', role: Role.ADMIN },
      } as any,
      {
        task_progress_score: 8,
        lecturer_note: 'Checkpoint updated',
      },
    );

    expect(semesterService.upsertCurrentGroupReview).toHaveBeenCalledWith(
      'group-1',
      'admin-1',
      Role.ADMIN,
      {
        task_progress_score: 8,
        lecturer_note: 'Checkpoint updated',
      },
    );
  });

  it('delegates review session CRUD and history methods', async () => {
    semesterService.createReviewSession.mockResolvedValue({ id: 'session-1' });
    semesterService.updateReviewSession.mockResolvedValue({ id: 'session-1' });
    semesterService.deleteReviewSession.mockResolvedValue({ deleted: true });
    semesterService.listGroupReviewSessions.mockResolvedValue({
      sessions: [],
    });
    semesterService.listGroupReviewSessionHistory.mockResolvedValue({
      history: [],
    });

    const request = {
      user: { id: 'lecturer-1', role: Role.LECTURER },
    } as any;

    await controller.createReviewSession('group-1', request, {
      milestone_code: ReviewMilestoneCode.REVIEW_1,
      review_date: '2026-04-08T10:00:00.000Z',
      title: 'Review 1 prep',
    });
    await controller.updateReviewSession('group-1', 'session-1', request, {
      lecturer_note: 'Updated note',
    });
    await controller.deleteReviewSession('group-1', 'session-1', request);
    await controller.listGroupReviewSessions('group-1', request);
    await controller.listGroupReviewSessionHistory(
      'group-1',
      request,
      ReviewMilestoneCode.REVIEW_1,
    );

    expect(semesterService.createReviewSession).toHaveBeenCalledWith(
      'group-1',
      'lecturer-1',
      Role.LECTURER,
      expect.objectContaining({
        milestone_code: ReviewMilestoneCode.REVIEW_1,
      }),
    );
    expect(semesterService.updateReviewSession).toHaveBeenCalledWith(
      'group-1',
      'session-1',
      'lecturer-1',
      Role.LECTURER,
      expect.objectContaining({ lecturer_note: 'Updated note' }),
    );
    expect(semesterService.deleteReviewSession).toHaveBeenCalledWith(
      'group-1',
      'session-1',
      'lecturer-1',
      Role.LECTURER,
    );
    expect(semesterService.listGroupReviewSessions).toHaveBeenCalledWith(
      'group-1',
      'lecturer-1',
      Role.LECTURER,
    );
    expect(semesterService.listGroupReviewSessionHistory).toHaveBeenCalledWith(
      'group-1',
      'lecturer-1',
      Role.LECTURER,
      ReviewMilestoneCode.REVIEW_1,
    );
  });
});
