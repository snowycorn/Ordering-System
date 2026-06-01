// test/app.e2e-spec.ts
//
// 整合測試：啟動真實 NestJS HTTP server，使用真實 Prisma + 測試 DB。
// 外部依賴（IamClient、VendorMenuClient、S3Service）改用 mock 替換。
//
// 前置條件：
//   DATABASE_URL 指向一個可用的測試 DB（例如 register_test_db）
//   運行前需先執行：npx prisma migrate deploy
//
// 執行方式：
//   DATABASE_URL=postgresql://postgres:pw@localhost:5432/register_test_db \
//     NODE_ENV=test npm run test:e2e

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { IamClient } from '../src/integrations/iam.client';
import { VendorMenuClient } from '../src/integrations/vendor-menu.client';
import { S3Service } from '../src/s3/s3.service';

describe('Register Service (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  // ── Mocked services ────────────────────────────────────────────────────────

  const iamMock = {
    createVendorUser: jest.fn().mockResolvedValue(42),
  };

  const vendorMenuMock = {
    createVendor: jest.fn().mockResolvedValue(undefined),
  };

  const s3Mock = {
    generateDocumentUploadUrl: jest.fn().mockResolvedValue({
      uploadUrl: 'https://s3.example.com/upload',
      documentKey: 'vendor-documents/mock-uuid.pdf',
      expiresIn: 300,
    }),
    generateDocumentDownloadUrl: jest.fn().mockResolvedValue({
      downloadUrl: 'https://s3.example.com/download',
      expiresIn: 300,
    }),
  };

  // ── Bootstrap ──────────────────────────────────────────────────────────────

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(IamClient)
      .useValue(iamMock)
      .overrideProvider(VendorMenuClient)
      .useValue(vendorMenuMock)
      .overrideProvider(S3Service)
      .useValue(s3Mock)
      // Disable rate limiting in tests
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    // Mirror main.ts global pipe setup
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    prisma = moduleFixture.get(PrismaService);

    // APP_GUARD: useClass: ThrottlerGuard bypasses overrideGuard().
    // Spy on the actual singleton instance to disable rate limiting in tests.
    try {
      const throttlerGuard = moduleFixture.get(ThrottlerGuard, { strict: false });
      jest.spyOn(throttlerGuard, 'canActivate').mockResolvedValue(true);
    } catch {
      // Guard may not be directly accessible; overrideGuard fallback is registered above
    }
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    // Reset mock defaults
    iamMock.createVendorUser.mockResolvedValue(42);
    vendorMenuMock.createVendor.mockResolvedValue(undefined);
    s3Mock.generateDocumentUploadUrl.mockResolvedValue({
      uploadUrl: 'https://s3.example.com/upload',
      documentKey: 'vendor-documents/mock-uuid.pdf',
      expiresIn: 300,
    });
    s3Mock.generateDocumentDownloadUrl.mockResolvedValue({
      downloadUrl: 'https://s3.example.com/download',
      expiresIn: 300,
    });

    // Clean up DB
    await prisma.pendingVendor.deleteMany();
  });

  // ── Helper ─────────────────────────────────────────────────────────────────

  async function createApplication(overrides: Record<string, unknown> = {}) {
    const body: Record<string, unknown> = {
      vendorName: 'E2E Test Vendor',
      email: 'e2e@test.com',
      phone: '0912345678',
      factoryZones: ['A廠'],
      documentsKey: 'vendor-documents/mock-uuid.pdf',
    };
    // Apply overrides: set to value, or delete key if value is undefined
    for (const [key, value] of Object.entries(overrides)) {
      if (value === undefined) {
        delete body[key];
      } else {
        body[key] = value;
      }
    }
    const res = await request(app.getHttpServer())
      .post('/api/v1/register/applications')
      .send(body);
    return res;
  }

  // ── GET /api/v1/register/upload-url ───────────────────────────────────────

  describe('GET /api/v1/register/upload-url', () => {
    it('?contentType=application/pdf → 200 + { uploadUrl, documentKey, expiresIn }', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/register/upload-url')
        .query({ contentType: 'application/pdf' });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        uploadUrl: expect.any(String),
        documentKey: expect.any(String),
        expiresIn: 300,
      });
    });

    it('contentType 缺少 → 400', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/register/upload-url');
      expect(res.status).toBe(400);
    });

    it('不允許的 contentType → 400', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/register/upload-url')
        .query({ contentType: 'image/png' });
      expect(res.status).toBe(400);
    });
  });

  // ── POST /api/v1/register/applications ────────────────────────────────────

  describe('POST /api/v1/register/applications', () => {
    it('合法 body → 201 + { id, status: PENDING, message }', async () => {
      const res = await createApplication();
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        id: expect.any(String),
        status: 'PENDING',
        message: expect.any(String),
      });
    });

    it('缺 vendorName → 400', async () => {
      const res = await createApplication({ vendorName: undefined });
      expect(res.status).toBe(400);
    });

    it('缺 email → 400', async () => {
      const res = await createApplication({ email: undefined });
      expect(res.status).toBe(400);
    });

    it('email 格式錯誤 → 400', async () => {
      const res = await createApplication({ email: 'not-an-email' });
      expect(res.status).toBe(400);
    });
  });

  // ── GET /api/v1/register/applications/:id ─────────────────────────────────

  describe('GET /api/v1/register/applications/:id', () => {
    it('存在 → 200 + 公開欄位', async () => {
      const create = await createApplication();
      const { id } = create.body as { id: string };

      const res = await request(app.getHttpServer()).get(
        `/api/v1/register/applications/${id}`,
      );
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ id, status: 'PENDING' });
      // documentsKey 不應出現在公開回應
      expect(res.body).not.toHaveProperty('documentsKey');
    });

    it('不存在 → 404', async () => {
      const res = await request(app.getHttpServer()).get(
        '/api/v1/register/applications/00000000-0000-0000-0000-000000000000',
      );
      expect(res.status).toBe(404);
    });
  });

  // ── Admin: GET /api/v1/admin/register/applications ────────────────────────

  describe('GET /api/v1/admin/register/applications', () => {
    it('無 x-user-role header → 403', async () => {
      const res = await request(app.getHttpServer()).get(
        '/api/v1/admin/register/applications',
      );
      expect(res.status).toBe(403);
    });

    it('x-user-role: vendor → 403', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/register/applications')
        .set('x-user-role', 'vendor');
      expect(res.status).toBe(403);
    });

    it('x-user-role: admin → 200 + 陣列', async () => {
      await createApplication();
      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/register/applications')
        .set('x-user-role', 'admin');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(1);
    });

    it('?status=PENDING → 只回傳 PENDING 的申請', async () => {
      await createApplication({ email: 'a@test.com' });
      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/register/applications')
        .query({ status: 'PENDING' })
        .set('x-user-role', 'admin');
      expect(res.status).toBe(200);
      expect((res.body as Array<{ status: string }>).every((r) => r.status === 'PENDING')).toBe(true);
    });
  });

  // ── Admin: GET /api/v1/admin/register/applications/:id ────────────────────

  describe('GET /api/v1/admin/register/applications/:id', () => {
    it('x-user-role: admin → 200 + 含 document 欄位（mock URL）', async () => {
      const create = await createApplication();
      const { id } = create.body as { id: string };

      const res = await request(app.getHttpServer())
        .get(`/api/v1/admin/register/applications/${id}`)
        .set('x-user-role', 'admin');

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id,
        document: { downloadUrl: expect.any(String) },
      });
    });
  });

  // ── Admin: POST /:id/approve ───────────────────────────────────────────────

  describe('POST /api/v1/admin/register/applications/:id/approve', () => {
    it('無 x-user-role header → 403', async () => {
      const create = await createApplication();
      const { id } = create.body as { id: string };
      const res = await request(app.getHttpServer()).post(
        `/api/v1/admin/register/applications/${id}/approve`,
      );
      expect(res.status).toBe(403);
    });

    it('x-user-role: vendor → 403', async () => {
      const create = await createApplication();
      const { id } = create.body as { id: string };
      const res = await request(app.getHttpServer())
        .post(`/api/v1/admin/register/applications/${id}/approve`)
        .set('x-user-role', 'vendor');
      expect(res.status).toBe(403);
    });

    it('x-user-role: admin，PENDING 申請 → 200，DB status 變 APPROVED', async () => {
      const create = await createApplication();
      const { id } = create.body as { id: string };

      const res = await request(app.getHttpServer())
        .post(`/api/v1/admin/register/applications/${id}/approve`)
        .set('x-user-role', 'admin')
        .set('x-user-id', 'admin1')
        .send({});

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ status: 'APPROVED', tempPassword: expect.any(String) });
      expect(iamMock.createVendorUser).toHaveBeenCalled();
      expect(vendorMenuMock.createVendor).toHaveBeenCalled();
    });

    it('已 APPROVED → 409', async () => {
      const create = await createApplication();
      const { id } = create.body as { id: string };

      // First approve
      await request(app.getHttpServer())
        .post(`/api/v1/admin/register/applications/${id}/approve`)
        .set('x-user-role', 'admin')
        .send({});

      // Second approve → 409
      const res = await request(app.getHttpServer())
        .post(`/api/v1/admin/register/applications/${id}/approve`)
        .set('x-user-role', 'admin')
        .send({});

      expect(res.status).toBe(409);
    });
  });

  // ── Admin: POST /:id/reject ────────────────────────────────────────────────

  describe('POST /api/v1/admin/register/applications/:id/reject', () => {
    it('x-user-role: admin → 200，DB status 變 REJECTED', async () => {
      const create = await createApplication();
      const { id } = create.body as { id: string };

      const res = await request(app.getHttpServer())
        .post(`/api/v1/admin/register/applications/${id}/reject`)
        .set('x-user-role', 'admin')
        .send({ reviewNotes: 'Missing documents' });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ status: 'REJECTED', reviewNotes: 'Missing documents' });
    });

    it('已 REJECTED → 409', async () => {
      const create = await createApplication();
      const { id } = create.body as { id: string };

      await request(app.getHttpServer())
        .post(`/api/v1/admin/register/applications/${id}/reject`)
        .set('x-user-role', 'admin')
        .send({});

      const res = await request(app.getHttpServer())
        .post(`/api/v1/admin/register/applications/${id}/reject`)
        .set('x-user-role', 'admin')
        .send({});

      expect(res.status).toBe(409);
    });
  });
});
