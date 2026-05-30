// src/applications/controllers/admin-applications.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { AdminApplicationsController } from './admin-applications.controller';
import { ApplicationsService } from '../applications.service';

const applicationsMock = {
  listForAdmin: jest.fn(),
  getForAdmin: jest.fn(),
  getDocumentUrl: jest.fn(),
  approve: jest.fn(),
  reject: jest.fn(),
};

describe('AdminApplicationsController', () => {
  let controller: AdminApplicationsController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminApplicationsController],
      providers: [
        { provide: ApplicationsService, useValue: applicationsMock },
      ],
    }).compile();

    controller = module.get(AdminApplicationsController);
  });

  // ── list() ─────────────────────────────────────────────────────────────────

  describe('list()', () => {
    it('無 status 時呼叫 listForAdmin(undefined)', async () => {
      applicationsMock.listForAdmin.mockResolvedValue([]);
      await controller.list({});
      expect(applicationsMock.listForAdmin).toHaveBeenCalledWith(undefined);
    });

    it('有 status 時把 status 轉發給 listForAdmin', async () => {
      applicationsMock.listForAdmin.mockResolvedValue([]);
      await controller.list({ status: 'PENDING' });
      expect(applicationsMock.listForAdmin).toHaveBeenCalledWith('PENDING');
    });

    it('回傳 service 的結果', async () => {
      const mockList = [{ id: '1', status: 'PENDING' }];
      applicationsMock.listForAdmin.mockResolvedValue(mockList);
      const result = await controller.list({});
      expect(result).toEqual(mockList);
    });
  });

  // ── getOne() ───────────────────────────────────────────────────────────────

  describe('getOne()', () => {
    it('把 id 轉發給 getForAdmin 並回傳結果', async () => {
      const mockResult = { id: 'abc', status: 'PENDING', document: null };
      applicationsMock.getForAdmin.mockResolvedValue(mockResult);

      const result = await controller.getOne('abc');

      expect(applicationsMock.getForAdmin).toHaveBeenCalledWith('abc');
      expect(result).toEqual(mockResult);
    });
  });

  // ── getDocumentUrl() ───────────────────────────────────────────────────────

  describe('getDocumentUrl()', () => {
    it('把 id 轉發給 getDocumentUrl 並回傳結果', async () => {
      const mockResult = { downloadUrl: 'https://s3.example.com/doc.pdf', expiresIn: 300 };
      applicationsMock.getDocumentUrl.mockResolvedValue(mockResult);

      const result = await controller.getDocumentUrl('abc');

      expect(applicationsMock.getDocumentUrl).toHaveBeenCalledWith('abc');
      expect(result).toEqual(mockResult);
    });
  });

  // ── approve() ─────────────────────────────────────────────────────────────

  describe('approve()', () => {
    it('把 id、reviewedBy、dto 轉發給 service.approve', async () => {
      const mockResult = { id: 'abc', status: 'APPROVED', tempPassword: 'tmp-pw' };
      applicationsMock.approve.mockResolvedValue(mockResult);

      const result = await controller.approve('abc', 'admin1', { reviewNotes: 'OK' });

      expect(applicationsMock.approve).toHaveBeenCalledWith('abc', 'admin1', {
        reviewNotes: 'OK',
      });
      expect(result).toEqual(mockResult);
    });

    it('reviewedBy 未帶（Gateway 沒注入 x-user-id）時傳 undefined', async () => {
      applicationsMock.approve.mockResolvedValue({ id: 'abc', status: 'APPROVED' });

      await controller.approve('abc', undefined as unknown as string, {});

      expect(applicationsMock.approve).toHaveBeenCalledWith('abc', undefined, {});
    });
  });

  // ── reject() ──────────────────────────────────────────────────────────────

  describe('reject()', () => {
    it('把 id、reviewedBy、dto 轉發給 service.reject', async () => {
      const mockResult = { id: 'abc', status: 'REJECTED', reviewNotes: 'missing docs' };
      applicationsMock.reject.mockResolvedValue(mockResult);

      const result = await controller.reject('abc', 'admin1', { reviewNotes: 'missing docs' });

      expect(applicationsMock.reject).toHaveBeenCalledWith('abc', 'admin1', {
        reviewNotes: 'missing docs',
      });
      expect(result).toEqual(mockResult);
    });
  });
});
