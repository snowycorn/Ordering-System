import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import {
  PrometheusModule,
  makeCounterProvider,
  makeHistogramProvider,
} from '@willsoto/nestjs-prometheus';
import { MetricsInterceptor } from './metrics.interceptor';

/**
 * 可觀測性模組：
 *  - PrometheusModule 暴露 GET /metrics（含 Node process/GC/heap 等預設 metric）。
 *  - 註冊 http_requests_total / http_request_duration_seconds 兩個自訂 metric。
 *  - 以 APP_INTERCEPTOR 全域掛上 MetricsInterceptor，對每個 HTTP 請求埋點。
 *
 * /metrics 走 VPC 內網由 Prometheus 直抓，不經 Kong；全域 RolesGuard 對無 @Roles()
 * 的端點放行，故 /metrics 不會被 JWT/角色擋下。
 */
@Module({
  imports: [
    PrometheusModule.register({
      defaultMetrics: { enabled: true },
    }),
  ],
  providers: [
    makeCounterProvider({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code'],
    }),
    makeHistogramProvider({
      name: 'http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
    }),
    {
      provide: APP_INTERCEPTOR,
      useClass: MetricsInterceptor,
    },
  ],
})
export class MetricsModule {}
