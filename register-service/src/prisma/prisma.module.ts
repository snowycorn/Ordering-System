// src/prisma/prisma.module.ts
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global() // 加上 @Global() 裝飾器，讓 PrismaService 變成全域共用
@Module({
  providers: [PrismaService],
  exports: [PrismaService], // 匯出 PrismaService
})
export class PrismaModule {}
