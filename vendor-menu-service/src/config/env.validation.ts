// src/config/env.validation.ts
import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3000),

  // PostgreSQL 連線字串（必填）
  DATABASE_URL: Joi.string().required(),

  // AWS Region（選填）
  // 設定時：明確指定（兩種憑證模式均可用）
  // 不設定：SDK 自動從 EC2 Instance Metadata 取得（僅 Instance Profile 模式有效）
  AWS_REGION: Joi.string().optional(),

  // S3 Bucket 名稱：生產環境必填，開發可選
  AWS_S3_BUCKET_NAME: Joi.string().when('NODE_ENV', {
    is: 'production',
    then: Joi.required(),
    otherwise: Joi.optional().default('local-dev-bucket'),
  }),

  // CloudFront Domain（選填）：設定後 imageUrl 會走 CDN，否則走 S3 直連
  // 範例：d1234abcd.cloudfront.net
  AWS_CLOUDFRONT_DOMAIN: Joi.string().optional(),
});
