// src/applications/controllers/public-applications.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { PublicApplicationsController } from './public-applications.controller';
import { ApplicationsService } from '../applications.service';
import { S3Service } from '../../s3/s3.service';

const applicationsMock = {
  create: jest.fn(),
  getPublicStatus: jest.fn(),
};

const s3Mock = {
  generateDocumentUploadUrl: jest.fn(),
};

describe('PublicApplicationsController', () => {
  let controller: PublicApplicationsController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PublicApplicationsController],
      providers: [
        { provide: ApplicationsService, useValue: applicationsMock },
        { provide: S3Service, useValue: s3Mock },
      ],
    }).compile();

    controller = module.get(PublicApplicationsController);
  });

  // ── getUploadUrl() ─────────────────────────────────────────────────────────

  describe('getUploadUrl()', () => {
    it('把 contentType 轉發給 S3Service.generateDocumentUploadUrl', async () => {
      const mockResult = {
        uploadUrl: 'https://s3.example.com/upload',
        documentKey: 'vendor-documents/uuid.pdf',
        expiresIn: 300,
      };
      s3Mock.generateDocumentUploadUrl.mockResolvedValue(mockResult);

      const result = await controller.getUploadUrl({ contentType: 'application/pdf' });

      expect(s3Mock.generateDocumentUploadUrl).toHaveBeenCalledWith('application/pdf');
      expect(result).toEqual(mockResult);
    });
  });

  // ── create() ──────────────────────────────────────────────────────────────

  describe('create()', () => {
    it('把 dto 轉發給 ApplicationsService.create 並回傳結果', async () => {
      const dto = {
        vendorName: 'Test Vendor',
        email: 'v@test.com',
        phone: '0912345678',
        factoryZone: 'North',
        documentsKey: 'vendor-documents/uuid.pdf',
      };
      const mockResult = {
        id: 'abc-123',
        status: 'PENDING',
        createdAt: new Date(),
        message: '入駐申請已送出',
      };
      applicationsMock.create.mockResolvedValue(mockResult);

      const result = await controller.create(dto);

      expect(applicationsMock.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockResult);
    });
  });

  // ── getStatus() ────────────────────────────────────────────────────────────

  describe('getStatus()', () => {
    it('把 id 轉發給 ApplicationsService.getPublicStatus 並回傳結果', async () => {
      const mockResult = {
        id: 'abc-123',
        vendorName: 'Test Vendor',
        status: 'PENDING',
        reviewNotes: null,
        createdAt: new Date(),
        reviewedAt: null,
      };
      applicationsMock.getPublicStatus.mockResolvedValue(mockResult);

      const result = await controller.getStatus('abc-123');

      expect(applicationsMock.getPublicStatus).toHaveBeenCalledWith('abc-123');
      expect(result).toEqual(mockResult);
    });
  });
});
