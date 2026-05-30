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

    it('POST - 成功 (Admin)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/admin/vendors')
        .set(adminHeader)
        .send({ name: 'E2E Vendor', category: 'Test', factoryZone: 'A廠' })
        .expect(201);
      
      expect(res.body.id).toBeDefined();
      expect(res.body.name).toBe('E2E Vendor');
      expect(res.body.status).toBe('ACTIVE');
      
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
      expect(res.body.every((v: any) => v.factoryZone === 'A廠')).toBe(true);
    });
  });

  describe('商家自管端點 (GET|PUT /api/v1/vendors/me)', () => {
    it('GET /me - 成功', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/vendors/me')
        .set('x-user-id', testVendorId)
        .expect(200);
      
      expect(res.body.id).toBe(testVendorId);
    });

    it('PUT /me - 成功', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/v1/vendors/me')
        .set('x-user-id', testVendorId)
        .send({ name: 'E2E Vendor Updated' })
        .expect(200);
      
      expect(res.body.name).toBe('E2E Vendor Updated');
    });

    it('GET /me - 失敗 (不存在的 ID)', async () => {
      const fakeVendorId = '00000000-0000-0000-0000-000000000000';
      await request(app.getHttpServer())
        .get('/api/v1/vendors/me')
        .set('x-user-id', fakeVendorId)
        .expect(404);
    });

    it('PUT /me - 失敗 (不存在的 ID)', async () => {
      const fakeVendorId = '00000000-0000-0000-0000-000000000000';
      await request(app.getHttpServer())
        .put('/api/v1/vendors/me')
        .set('x-user-id', fakeVendorId)
        .send({ name: 'Hacked Vendor' })
        .expect(404);
    });
  });
});
