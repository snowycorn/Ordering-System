import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('MenusController (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  let vendorAId: string;
  let vendorBId: string;
  let menuAId: string;

  // x-user-id 現在帶的是 IAM 數字 userId（由 Vendor.userId 解析回 vendor）
  const vendorAUserId = 90001;
  const vendorBUserId = 90002;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);

    // Create 2 fake vendors for testing ownership logic
    const vendorA = await prisma.vendor.create({
      data: { name: 'Vendor A', category: 'Testing', status: 'ACTIVE', userId: vendorAUserId, factoryZones: ['A廠'] }
    });
    vendorAId = vendorA.id;

    const vendorB = await prisma.vendor.create({
      data: { name: 'Vendor B', category: 'Testing', status: 'ACTIVE', userId: vendorBUserId }
    });
    vendorBId = vendorB.id;
  });

  afterAll(async () => {
    // Delete test vendors, this will cascade delete their menus
    if (vendorAId) await prisma.vendor.delete({ where: { id: vendorAId } }).catch(() => { });
    if (vendorBId) await prisma.vendor.delete({ where: { id: vendorBId } }).catch(() => { });
    await app.close();
  });

  describe('商家私有端點 (Vendor Private Routes)', () => {
    it('POST /api/v1/vendors/me/menus - 新增菜單 (Vendor A)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/vendors/me/menus')
        .set('x-user-id', String(vendorAUserId))
        .send({ name: 'Menu A', price: 100, dailyLimit: 50, tags: ['BEEF', 'SPICY'] })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.vendorId).toBe(vendorAId);
      expect(res.body.tags).toEqual(['BEEF', 'SPICY']);
      menuAId = res.body.id;
    });

    it('POST /api/v1/vendors/me/menus - 拒絕非法 tag (400)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/vendors/me/menus')
        .set('x-user-id', String(vendorAUserId))
        .send({ name: 'Bad Tag Menu', price: 80, tags: ['NOT_A_REAL_TAG'] })
        .expect(400);
    });

    it('GET /api/v1/vendors/me/menus - 查詢自己的菜單', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/vendors/me/menus')
        .set('x-user-id', String(vendorAUserId))
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      const found = res.body.find((m: any) => m.id === menuAId);
      expect(found).toBeDefined();
    });

    it('GET /api/v1/vendors/me/menus/upload-image-url - 取得 S3 上傳連結', async () => {
      const res = await request(app.getHttpServer())
        .get(encodeURI('/api/v1/vendors/me/menus/upload-image-url?contentType=image/jpeg'))
        .set('x-user-id', String(vendorAUserId))
        .expect(200);

      expect(res.body.uploadUrl).toBeDefined();
      expect(res.body.imageUrl).toBeDefined();
    });

    it('PUT /api/v1/vendors/me/menus/:menuId/quotas - 設定每日限量', async () => {
      // 必須設定未來日期
      const futureDate = '2099-12-31';
      const res = await request(app.getHttpServer())
        .put(`/api/v1/vendors/me/menus/${menuAId}/quotas`)
        .set('x-user-id', String(vendorAUserId))
        .send({ targetDate: futureDate, maxQuantity: 20 })
        .expect(200);

      expect(res.body.maxQuantity).toBe(20);
    });

    it('PUT /api/v1/vendors/me/menus/:menuId/quotas - 阻擋設定過去日期', async () => {
      const pastDate = '2000-01-01';
      await request(app.getHttpServer())
        .put(`/api/v1/vendors/me/menus/${menuAId}/quotas`)
        .set('x-user-id', String(vendorAUserId))
        .send({ targetDate: pastDate, maxQuantity: 20 })
        .expect(400); // BadRequest
    });
  });

  describe('越權存取防護 (Security / IDOR Tests)', () => {
    it('PUT /api/v1/vendors/me/menus/:menuId - 修改別人的菜單 (Vendor B 改 A)', async () => {
      await request(app.getHttpServer())
        .put(`/api/v1/vendors/me/menus/${menuAId}`)
        .set('x-user-id', String(vendorBUserId))
        .send({ price: 200 })
        .expect(404);
    });

    it('PUT /api/v1/vendors/me/menus/:menuId/quotas - 設定別人的配額', async () => {
      await request(app.getHttpServer())
        .put(`/api/v1/vendors/me/menus/${menuAId}/quotas`)
        .set('x-user-id', String(vendorBUserId))
        .send({ targetDate: '2099-12-31', maxQuantity: 10 })
        .expect(404);
    });

    it('DELETE /api/v1/vendors/me/menus/:menuId - 刪除別人的菜單', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/vendors/me/menus/${menuAId}`)
        .set('x-user-id', String(vendorBUserId))
        .expect(404);
    });
  });

  describe('軟刪除與公開端點 (Soft Delete & Public Routes)', () => {
    it('GET /api/v1/menus - 全量查詢 (包含 Menu A)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/menus')
        .expect(200);

      const found = res.body.find((m: any) => m.id === menuAId);
      expect(found).toBeDefined();
      expect(found.tags).toEqual(['BEEF', 'SPICY']);
    });

    it('GET /api/v1/menus/tags - 回傳 13 個 tag 選項 (code + label)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/menus/tags')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(13);
      expect(res.body).toContainEqual({ code: 'BEEF', label: '牛' });
      res.body.forEach((t: any) => {
        expect(typeof t.code).toBe('string');
        expect(typeof t.label).toBe('string');
      });
    });

    it('GET /api/v1/menus?tags=BEEF - 命中含該 tag 的 Menu A', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/menus?tags=BEEF')
        .expect(200);

      const found = res.body.find((m: any) => m.id === menuAId);
      expect(found).toBeDefined();
    });

    it('GET /api/v1/menus?tags=BEEF&tags=MILD - AND 語意：Menu A 不含 MILD 故被排除', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/menus?tags=BEEF&tags=MILD')
        .expect(200);

      const found = res.body.find((m: any) => m.id === menuAId);
      expect(found).toBeUndefined();
    });

    it('GET /api/v1/menus?factoryZone=A廠 - Vendor A 服務 A廠，命中 Menu A', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/menus?factoryZone=A廠')
        .expect(200);

      const found = res.body.find((m: any) => m.id === menuAId);
      expect(found).toBeDefined();
    });

    it('GET /api/v1/menus?factoryZone=B廠 - Vendor A 不服務 B廠，排除 Menu A', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/menus?factoryZone=B廠')
        .expect(200);

      const found = res.body.find((m: any) => m.id === menuAId);
      expect(found).toBeUndefined();
    });

    it('GET /api/v1/menus?isActive=false - 參數被 whitelist 剝除，仍只回上架菜單 (含 Menu A)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/menus?isActive=false')
        .expect(200);

      const found = res.body.find((m: any) => m.id === menuAId);
      expect(found).toBeDefined();
      expect(res.body.every((m: any) => m.isActive === true)).toBe(true);
    });

    it('DELETE /api/v1/vendors/me/menus/:menuId - 軟刪除 (Vendor A)', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/v1/vendors/me/menus/${menuAId}`)
        .set('x-user-id', String(vendorAUserId))
        .expect(200);

      expect(res.body.isActive).toBe(false);
    });

    it('GET /api/v1/menus - 軟刪除後的全量查詢不應包含 Menu A', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/menus')
        .expect(200);

      const found = res.body.find((m: any) => m.id === menuAId);
      expect(found).toBeUndefined();
    });

    it('GET /api/v1/menus/:menuId - 軟刪除後查詢單筆應回傳 404', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/menus/${menuAId}`)
        .expect(404);
    });
  });
});
