import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DocumentStatus } from '../../common/enums';
import { DocumentSubmission } from '../../entities/document-submission.entity';
import { GroupMembership } from '../../entities/group-membership.entity';
import { DocumentSubmissionService } from './document-submission.service';

const mockRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  save: jest.fn(),
  create: jest.fn((value) => value),
});

describe('DocumentSubmissionService', () => {
  let service: DocumentSubmissionService;
  let submissionRepo: ReturnType<typeof mockRepo>;
  let membershipRepo: ReturnType<typeof mockRepo>;

  beforeEach(async () => {
    submissionRepo = mockRepo();
    membershipRepo = mockRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentSubmissionService,
        {
          provide: getRepositoryToken(DocumentSubmission),
          useValue: submissionRepo,
        },
        {
          provide: getRepositoryToken(GroupMembership),
          useValue: membershipRepo,
        },
      ],
    }).compile();

    service = module.get(DocumentSubmissionService);
  });

  it('creates a draft version with incremented version number', async () => {
    membershipRepo.findOne.mockResolvedValue({ id: 'membership-1' });
    submissionRepo.findOne
      .mockResolvedValueOnce({ version_number: 2 })
      .mockResolvedValueOnce(null);
    submissionRepo.save.mockImplementation(async (value) => value);

    const result = await service.saveDraftVersion('group-1', 'user-1', {
      title: 'SRS v3',
      reference: 'https://docs.example.com/v3',
      change_summary: 'Added FR and NFR updates',
      content_markdown: '# SRS v3',
    });

    expect(submissionRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        group_id: 'group-1',
        submitted_by_id: 'user-1',
        version_number: 3,
        status: DocumentStatus.DRAFT,
        change_summary: 'Added FR and NFR updates',
        content_markdown: '# SRS v3',
      }),
    );
    expect(result.status).toBe(DocumentStatus.DRAFT);
  });

  it('submits an existing draft version for lecturer review', async () => {
    submissionRepo.findOne.mockResolvedValue({
      id: 'submission-1',
      group_id: 'group-1',
      status: DocumentStatus.DRAFT,
    });
    membershipRepo.findOne.mockResolvedValue({ id: 'membership-1' });
    submissionRepo.save.mockImplementation(async (value) => value);

    const result = await service.submitVersion('submission-1', 'user-1');

    expect(result.status).toBe(DocumentStatus.PENDING);
  });

  it('rejects submission from non-member', async () => {
    submissionRepo.findOne.mockResolvedValue({
      id: 'submission-1',
      group_id: 'group-1',
      status: DocumentStatus.DRAFT,
    });
    membershipRepo.findOne.mockResolvedValue(null);

    await expect(
      service.submitVersion('submission-1', 'user-1'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('throws when submitting a missing version', async () => {
    submissionRepo.findOne.mockResolvedValue(null);

    await expect(service.submitVersion('missing', 'user-1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('updates an existing draft version in place', async () => {
    submissionRepo.findOne.mockResolvedValue({
      id: 'submission-1',
      group_id: 'group-1',
      title: 'SRS v1',
      status: DocumentStatus.DRAFT,
      reference: null,
      document_url: null,
      change_summary: null,
      content_markdown: null,
    });
    membershipRepo.findOne.mockResolvedValue({ id: 'membership-1' });
    submissionRepo.save.mockImplementation(async (value) => value);

    const result = await service.updateVersion('submission-1', 'user-1', {
      title: 'SRS v1 - revised',
      reference: 'https://docs.example.com/revised',
      change_summary: 'Refined scope',
      content_markdown: '# Revised SRS',
    });

    expect(result.title).toBe('SRS v1 - revised');
    expect(result.reference).toBe('https://docs.example.com/revised');
    expect(result.document_url).toBe('https://docs.example.com/revised');
    expect(result.change_summary).toBe('Refined scope');
    expect(result.content_markdown).toBe('# Revised SRS');
  });

  it('rejects update for non-draft version', async () => {
    submissionRepo.findOne.mockResolvedValue({
      id: 'submission-1',
      group_id: 'group-1',
      status: DocumentStatus.PENDING,
    });
    membershipRepo.findOne.mockResolvedValue({ id: 'membership-1' });

    await expect(
      service.updateVersion('submission-1', 'user-1', {
        title: 'cannot update',
      }),
    ).rejects.toThrow(ForbiddenException);
  });
});
