import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { VendorsModule } from './vendors/vendors.module';
import { MenusModule } from './menus/menus.module';
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
    // 特定端點（如 upload-image-url）可用 @Throttle() 裝飾器覆蓋
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000,
        limit: 100,
      },
    ]),
    PrismaModule,
    MenusModule,
    VendorsModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
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
