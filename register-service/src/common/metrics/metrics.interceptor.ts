import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter, Histogram } from 'prom-client';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';

/**
 * 全域 HTTP metrics 攔截器：對每個請求記錄
 *  - http_requests_total（counter）
 *  - http_request_duration_seconds（histogram）
 * labels: method / route / status_code。
 *
 * route 用「路由模板」（如 /api/v1/menus/:menuId）而非實際 id，避免 label 高基數。
 * /metrics 自身不記錄，避免自我噪音。
 */
@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(
    @InjectMetric('http_requests_total')
    private readonly requestsTotal: Counter<string>,
    @InjectMetric('http_request_duration_seconds')
    private readonly requestDuration: Histogram<string>,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const http = context.switchToHttp();
    const req = http.getRequest<Request>();

    if (req.path === '/metrics') {
      return next.handle();
    }

    const method = req.method;
    const endTimer = this.requestDuration.startTimer();

    return next.handle().pipe(
      tap({
        next: () => this.record(http.getResponse<Response>(), method, req, endTimer),
        error: () => this.record(http.getResponse<Response>(), method, req, endTimer),
      }),
    );
  }

  private record(
    res: Response,
    method: string,
    req: Request,
    endTimer: (labels?: Record<string, string | number>) => number,
  ): void {
    // 路由模板優先；未匹配到路由（如 404）標 'unmatched' 以免高基數
    const route: string =
      (req.route as { path?: string } | undefined)?.path ?? 'unmatched';
    const statusCode = String(res.statusCode);
    const labels = { method, route, status_code: statusCode };
    endTimer(labels);
    this.requestsTotal.inc(labels);
  }
}
