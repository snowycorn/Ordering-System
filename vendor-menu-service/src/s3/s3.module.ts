// src/s3/s3.module.ts
import { Module } from '@nestjs/common';
import { S3Service } from './s3.service';

@Module({
  providers: [S3Service],
  exports: [S3Service], // 匯出給 MenusModule 使用
})
export class S3Module {}
