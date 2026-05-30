import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { ApplicationsModule } from './applications/applications.module';
import { HealthModule } from './health/health.module';
import { envValidationSchema } from './config/env.validation';
import { RolesGuard } from './common/guards/roles.guard';

@Module({
  imports: [
    // 全域 config，啟動時驗證所有必要環境變數
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
      validationOptions: {
        abortEarly: true,
      },
    }),
    // 全域 Rate Limiting：預設 100 req / 60s / IP
    // 入駐相關公開端點（upload-url / 送出申請）另用 @Throttle() 收緊到 5 req/min
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000,
        limit: 100,
      },
    ]),
    PrismaModule,
    ApplicationsModule,
    HealthModule,
  ],
  providers: [
    Reflector,
    // ThrottlerGuard：全域限流
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    // RolesGuard：全域角色驗證（無 @Roles() 的端點自動放行）
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
