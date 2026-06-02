import { Test, TestingModule } from '@nestjs/testing';
import {
  Controller,
  Get,
  INestApplication,
  InternalServerErrorException,
} from '@nestjs/common';
import request from 'supertest';
import { MetricsModule } from './metrics.module';

// 會丟 500 的測試 controller；MetricsModule 以 APP_INTERCEPTOR 全域掛上攔截器，故會作用於此。
@Controller()
class BoomController {
  @Get('boom')
  boom(): never {
    throw new InternalServerErrorException('boom');
  }
}

describe('Metrics endpoint', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [MetricsModule],
      controllers: [BoomController],
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

  it('5xx 請求被記成 status_code="500"（回歸：避免誤記成 200）', async () => {
    await request(app.getHttpServer()).get('/boom').expect(500);

    const res = await request(app.getHttpServer()).get('/metrics').expect(200);
    expect(res.text).toMatch(/http_requests_total\{[^}]*status_code="500"/);
  });
});
