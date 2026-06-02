import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // 改用 pino 作為全域 logger，輸出 JSON 到 stdout（給 Promtail → Loki）
  app.useLogger(app.get(Logger));

  // 全域 ValidationPipe，所有路由都套用
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,       // 自動剔除 DTO 未定義的欄位
      forbidNonWhitelisted: true, // 若有非白名單欄位直接丟 400
      transform: true,       // 自動轉型（string → number 等）
    }),
  );

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);

  await app.listen(port);
  app.get(Logger).log(`[VendorMenuService] running on port ${port}`);
}
bootstrap();
