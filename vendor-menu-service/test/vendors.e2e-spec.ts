import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Vendors (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  
  let testVendorId: string;
  // x-user-id 帶 IAM 數字 userId，由 Vendor.userId 解析回 vendor
  const testVendorUserId = 90050;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    
    prisma = app.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    if (testVendorId) {
      await prisma.vendor.delete({ where: { id: testVendorId } }).catch(() => {});
    }
    await app.close();
  });

  describe('管理員端點 (POST|GET|PUT /api/v1/admin/vendors)', () => {
    const adminHeader = { 'x-user-role': 'admin' };
    const vendorHeader = { 'x-user-role': 'vendor' };

    it('POST - 失敗 (未帶 Header)', () => {
      return request(app.getHttpServer())
        .post('/api/v1/admin/vendors')
        .send({ name: 'E2E Vendor', category: 'Test' })
        .expect(403);
    });

    it('POST - 失敗 (角色錯誤)', () => {
      return request(app.getHttpServer())
        .post('/api/v1/admin/vendors')
        .set(vendorHeader)
        .send({ name: 'E2E Vendor', category: 'Test' })
        .expect(403);
    });

    it('POST - 失敗 (Validation 錯誤，缺少 name)', () => {
      return request(app.getHttpServer())
        .post('/api/v1/admin/vendors')
        .set(adminHeader)
        .send({ category: 'Test' })
        .expect(400);
    });

    it('POST - 失敗 (Validation 錯誤，非法廠區)', () => {
      return request(app.getHttpServer())
        .post('/api/v1/admin/vendors')
        .set(adminHeader)
        .send({ name: 'Bad Zone Vendor', factoryZones: ['X廠'] })
        .expect(400);
    });

    it('POST - 成功 (Admin)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/admin/vendors')
        .set(adminHeader)
        .send({ name: 'E2E Vendor', category: 'Test', factoryZones: ['A廠'], userId: testVendorUserId })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.name).toBe('E2E Vendor');
      expect(res.body.status).toBe('ACTIVE');
      expect(res.body.factoryZones).toEqual(['A廠']);

      testVendorId = res.body.id;
    });

    it('GET /:id - 失敗 (非 Admin)', () => {
      return request(app.getHttpServer())
        .get(`/api/v1/admin/vendors/${testVendorId}`)
        .expect(403);
    });

    it('GET /:id - 成功 (Admin)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/admin/vendors/${testVendorId}`)
        .set(adminHeader)
        .expect(200);
      
      expect(res.body.name).toBe('E2E Vendor');
    });
  });

  describe('公開查詢端點 (GET /api/v1/vendors)', () => {
    it('GET / - 成功回傳列表', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/vendors')
        .expect(200);
      
      expect(Array.isArray(res.body)).toBe(true);
      const found = res.body.find((v: any) => v.id === testVendorId);
      expect(found).toBeDefined();
    });

    it('GET /?factoryZone=A廠 - 成功過濾', async () => {
      const res = await request(app.getHttpServer())
        .get(encodeURI('/api/v1/vendors?factoryZone=A廠'))
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.every((v: any) => v.factoryZones.includes('A廠'))).toBe(true);
    });
  });

  describe('廠區清單端點 (GET /api/v1/vendors/factory-zones)', () => {
    it('GET / - 回傳合法廠區清單', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/vendors/factory-zones')
        .expect(200);

      expect(res.body).toContain('A廠');
    });
  });

  describe('商家自管端點 (GET|PUT /api/v1/vendors/me)', () => {
    it('GET /me - 成功', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/vendors/me')
        .set('x-user-id', String(testVendorUserId))
        .expect(200);

      expect(res.body.id).toBe(testVendorId);
    });

    it('PUT /me - 成功', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/v1/vendors/me')
        .set('x-user-id', String(testVendorUserId))
        .send({ name: 'E2E Vendor Updated' })
        .expect(200);

      expect(res.body.name).toBe('E2E Vendor Updated');
    });

    it('PUT /me - 商家不能自改廠區 (factoryZones 被 whitelist 剝除)', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/v1/vendors/me')
        .set('x-user-id', String(testVendorUserId))
        .send({ factoryZones: ['B廠', 'C廠'] })
        .expect(200);

      // 廠區維持建立時的 ['A廠']，未被商家自管請求改動
      expect(res.body.factoryZones).toEqual(['A廠']);
    });

    it('PUT /admin/vendors/:id - 管理員可改廠區', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/v1/admin/vendors/${testVendorId}`)
        .set('x-user-role', 'admin')
        .send({ factoryZones: ['B廠', 'C廠'] })
        .expect(200);

      expect(res.body.factoryZones).toEqual(['B廠', 'C廠']);
    });

    it('GET /me - 失敗 (不存在的 userId)', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/vendors/me')
        .set('x-user-id', '99999999')
        .expect(404);
    });

    it('PUT /me - 失敗 (不存在的 userId)', async () => {
      await request(app.getHttpServer())
        .put('/api/v1/vendors/me')
        .set('x-user-id', '99999999')
        .send({ name: 'Hacked Vendor' })
        .expect(404);
    });
  });
});
