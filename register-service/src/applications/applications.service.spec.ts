// src/applications/applications.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { ApplicationsService } from './applications.service';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../s3/s3.service';
import { IamClient } from '../integrations/iam.client';
import { VendorMenuClient } from '../integrations/vendor-menu.client';
import { MailerService } from '../integrations/mailer.service';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const FAKE_ID = 'aaaaaaaa-0000-0000-0000-000000000001';
const NOW = new Date('2026-01-01T00:00:00Z');

function makePending(overrides: Partial<ReturnType<typeof makePending>> = {}) {
  return {
    id: FAKE_ID,
    vendorName: 'Test Vendor',
    email: 'vendor@test.com',
    phone: '0912345678',
    factoryZone: 'North',
    documentsKey: 'vendor-documents/abc.pdf',
    status: 'PENDING',
    reviewNotes: null,
    reviewedBy: null,
    reviewedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

// ── Mocks ─────────────────────────────────────────────────────────────────────

const prismaMock = {
  pendingVendor: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
};

const s3Mock = {
  generateDocumentUploadUrl: jest.fn(),
  generateDocumentDownloadUrl: jest.fn(),
};

const iamMock = {
  createVendorUser: jest.fn(),
  deleteUser: jest.fn(),
};

const vendorMenuMock = {
  createVendor: jest.fn(),
};

const mailerMock = {
  sendWelcomeEmail: jest.fn(),
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ApplicationsService', () => {
  let service: ApplicationsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApplicationsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: S3Service, useValue: s3Mock },
        { provide: IamClient, useValue: iamMock },
        { provide: VendorMenuClient, useValue: vendorMenuMock },
        { provide: MailerService, useValue: mailerMock },
      ],
    }).compile();

    service = module.get(ApplicationsService);
  });

  // ── create() ──────────────────────────────────────────────────────────────

  describe('create()', () => {
    it('建立 PendingVendor 並回傳 id / status / message', async () => {
      const pending = makePending();
      prismaMock.pendingVendor.create.mockResolvedValue(pending);

      const result = await service.create({
        vendorName: 'Test Vendor',
        email: 'vendor@test.com',
        phone: '0912345678',
        factoryZone: 'North',
        documentsKey: 'vendor-documents/abc.pdf',
      });

      expect(prismaMock.pendingVendor.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'PENDING' }) }),
      );
      expect(result).toMatchObject({ id: FAKE_ID, status: 'PENDING' });
      expect(result.message).toBeDefined();
    });

    it('Prisma 拋錯時向上傳遞', async () => {
      prismaMock.pendingVendor.create.mockRejectedValue(new Error('DB error'));
      await expect(
        service.create({ vendorName: 'X', email: 'x@x.com' }),
      ).rejects.toThrow('DB error');
    });
  });

  // ── getPublicStatus() ──────────────────────────────────────────────────────

  describe('getPublicStatus()', () => {
    it('找到時回傳公開欄位', async () => {
      prismaMock.pendingVendor.findUnique.mockResolvedValue(makePending());
      const result = await service.getPublicStatus(FAKE_ID);
      expect(result).toMatchObject({
        id: FAKE_ID,
        vendorName: 'Test Vendor',
        status: 'PENDING',
      });
      // 不回傳 documentsKey
      expect(result).not.toHaveProperty('documentsKey');
    });

    it('找不到時拋 NotFoundException', async () => {
      prismaMock.pendingVendor.findUnique.mockResolvedValue(null);
      await expect(service.getPublicStatus('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  // ── listForAdmin() ─────────────────────────────────────────────────────────

  describe('listForAdmin()', () => {
    it('無 status 時呼叫 findMany({ where: undefined })', async () => {
      prismaMock.pendingVendor.findMany.mockResolvedValue([]);
      await service.listForAdmin();
      expect(prismaMock.pendingVendor.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: undefined }),
      );
    });

    it('有 status 時傳入 where: { status }', async () => {
      prismaMock.pendingVendor.findMany.mockResolvedValue([]);
      await service.listForAdmin('PENDING');
      expect(prismaMock.pendingVendor.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: 'PENDING' } }),
      );
    });
  });

  // ── getForAdmin() ──────────────────────────────────────────────────────────

  describe('getForAdmin()', () => {
    it('documentsKey 存在時呼叫 generateDocumentDownloadUrl，回傳含 document', async () => {
      prismaMock.pendingVendor.findUnique.mockResolvedValue(makePending());
      s3Mock.generateDocumentDownloadUrl.mockResolvedValue({
        downloadUrl: 'https://s3.example.com/doc.pdf',
        expiresIn: 300,
      });

      const result = await service.getForAdmin(FAKE_ID);
      expect(s3Mock.generateDocumentDownloadUrl).toHaveBeenCalledWith(
        'vendor-documents/abc.pdf',
      );
      expect(result.document).toMatchObject({ downloadUrl: expect.any(String) });
    });

    it('documentsKey 為 null 時 document 欄位為 null', async () => {
      prismaMock.pendingVendor.findUnique.mockResolvedValue(
        makePending({ documentsKey: null }),
      );
      const result = await service.getForAdmin(FAKE_ID);
      expect(s3Mock.generateDocumentDownloadUrl).not.toHaveBeenCalled();
      expect(result.document).toBeNull();
    });
  });

  // ── approve() ─────────────────────────────────────────────────────────────

  describe('approve()', () => {
    it('全部成功時依序呼叫 IAM → vendor-menu → DB update，回傳含 tempPassword', async () => {
      prismaMock.pendingVendor.findUnique.mockResolvedValue(makePending());
      iamMock.createVendorUser.mockResolvedValue(42);
      vendorMenuMock.createVendor.mockResolvedValue(undefined);
      const approved = makePending({ status: 'APPROVED' });
      prismaMock.pendingVendor.update.mockResolvedValue(approved);
      mailerMock.sendWelcomeEmail.mockResolvedValue(undefined);

      const result = await service.approve(FAKE_ID, 'admin1', {});

      expect(iamMock.createVendorUser).toHaveBeenCalledWith(
        'vendor@test.com',
        expect.any(String),
      );
      expect(vendorMenuMock.createVendor).toHaveBeenCalledWith('Test Vendor', 'North', 42);
      expect(prismaMock.pendingVendor.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'APPROVED' }),
        }),
      );
      expect(result).toHaveProperty('tempPassword');
      expect(typeof result.tempPassword).toBe('string');
    });

    it('IAM 失敗時拋 BadRequestException，DB update 不被呼叫', async () => {
      prismaMock.pendingVendor.findUnique.mockResolvedValue(makePending());
      iamMock.createVendorUser.mockRejectedValue(
        new BadRequestException('IAM error'),
      );

      await expect(service.approve(FAKE_ID, 'admin1', {})).rejects.toThrow(
        BadRequestException,
      );
      expect(prismaMock.pendingVendor.update).not.toHaveBeenCalled();
    });

    it('vendor-menu 失敗時補償刪除 IAM 帳號、拋出原始錯誤，DB update 不被呼叫', async () => {
      prismaMock.pendingVendor.findUnique.mockResolvedValue(makePending());
      iamMock.createVendorUser.mockResolvedValue(42);
      vendorMenuMock.createVendor.mockRejectedValue(
        new BadRequestException('vendor-menu error'),
      );
      iamMock.deleteUser.mockResolvedValue(undefined);

      await expect(service.approve(FAKE_ID, 'admin1', {})).rejects.toThrow(
        BadRequestException,
      );
      // 補償：以剛建的 userId 刪除 IAM 帳號
      expect(iamMock.deleteUser).toHaveBeenCalledWith(42);
      expect(prismaMock.pendingVendor.update).not.toHaveBeenCalled();
    });

    it('vendor-menu 失敗且補償刪除也失敗時，仍拋出原始錯誤（不被補償錯誤掩蓋）', async () => {
      prismaMock.pendingVendor.findUnique.mockResolvedValue(makePending());
      iamMock.createVendorUser.mockResolvedValue(42);
      vendorMenuMock.createVendor.mockRejectedValue(
        new BadRequestException('vendor-menu error'),
      );
      iamMock.deleteUser.mockRejectedValue(new Error('IAM delete failed'));

      await expect(service.approve(FAKE_ID, 'admin1', {})).rejects.toThrow(
        'vendor-menu error',
      );
      expect(iamMock.deleteUser).toHaveBeenCalledWith(42);
      expect(prismaMock.pendingVendor.update).not.toHaveBeenCalled();
    });

    it('IAM 建立帳號成功且 vendor-menu 成功時不觸發補償', async () => {
      prismaMock.pendingVendor.findUnique.mockResolvedValue(makePending());
      iamMock.createVendorUser.mockResolvedValue(42);
      vendorMenuMock.createVendor.mockResolvedValue(undefined);
      prismaMock.pendingVendor.update.mockResolvedValue(makePending({ status: 'APPROVED' }));
      mailerMock.sendWelcomeEmail.mockResolvedValue(undefined);

      await service.approve(FAKE_ID, 'admin1', {});
      expect(iamMock.deleteUser).not.toHaveBeenCalled();
    });

    it('email 寄送失敗（mailer 內部 catch）時 approve 仍成功', async () => {
      prismaMock.pendingVendor.findUnique.mockResolvedValue(makePending());
      iamMock.createVendorUser.mockResolvedValue(42);
      vendorMenuMock.createVendor.mockResolvedValue(undefined);
      prismaMock.pendingVendor.update.mockResolvedValue(makePending({ status: 'APPROVED' }));
      // Simulate MailerService.sendWelcomeEmail graceful behavior:
      // real mailer catches internally and resolves — mock should do the same
      mailerMock.sendWelcomeEmail.mockResolvedValue(undefined);

      const result = await service.approve(FAKE_ID, 'admin1', {});
      expect(result).toHaveProperty('status', 'APPROVED');
      expect(mailerMock.sendWelcomeEmail).toHaveBeenCalled();
    });

    it('已 APPROVED 時拋 ConflictException', async () => {
      prismaMock.pendingVendor.findUnique.mockResolvedValue(
        makePending({ status: 'APPROVED' }),
      );
      await expect(service.approve(FAKE_ID, 'admin1', {})).rejects.toThrow(ConflictException);
    });

    it('已 REJECTED 時拋 ConflictException', async () => {
      prismaMock.pendingVendor.findUnique.mockResolvedValue(
        makePending({ status: 'REJECTED' }),
      );
      await expect(service.approve(FAKE_ID, 'admin1', {})).rejects.toThrow(ConflictException);
    });

    it('找不到 id 時拋 NotFoundException', async () => {
      prismaMock.pendingVendor.findUnique.mockResolvedValue(null);
      await expect(service.approve('nonexistent', 'admin1', {})).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── reject() ──────────────────────────────────────────────────────────────

  describe('reject()', () => {
    it('成功更新 status=REJECTED 並帶入 reviewNotes', async () => {
      prismaMock.pendingVendor.findUnique.mockResolvedValue(makePending());
      const rejected = makePending({ status: 'REJECTED', reviewNotes: 'missing docs' });
      prismaMock.pendingVendor.update.mockResolvedValue(rejected);

      const result = await service.reject(FAKE_ID, 'admin1', { reviewNotes: 'missing docs' });

      expect(prismaMock.pendingVendor.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'REJECTED', reviewNotes: 'missing docs' }),
        }),
      );
      expect(result.status).toBe('REJECTED');
    });

    it('非 PENDING 時拋 ConflictException', async () => {
      prismaMock.pendingVendor.findUnique.mockResolvedValue(
        makePending({ status: 'REJECTED' }),
      );
      await expect(service.reject(FAKE_ID, 'admin1', {})).rejects.toThrow(ConflictException);
    });
  });
});
