import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { MetricsModule } from './metrics.module';

describe('Metrics endpoint', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [MetricsModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /metrics 回 200 且暴露自訂與預設 metric', async () => {
    const res = await request(app.getHttpServer()).get('/metrics').expect(200);

    // 自訂 HTTP metric 已註冊
    expect(res.text).toContain('http_request_duration_seconds');
    expect(res.text).toContain('http_requests_total');
    // Node 預設 metric 也有
    expect(res.text).toContain('process_cpu_user_seconds_total');
  });
});
