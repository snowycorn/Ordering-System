// src/config/env.validation.ts
import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3008),

  // PostgreSQL 連線字串（必填）
  DATABASE_URL: Joi.string().required(),

  // AWS Region（選填）
  // 設定時：明確指定（兩種憑證模式均可用）
  // 不設定：SDK 自動從 EC2 Instance Metadata 取得（僅 Instance Profile 模式有效）
  AWS_REGION: Joi.string().optional(),

  // 私有 S3 Bucket 名稱（存放營登 PDF）：生產環境必填，開發可選
  AWS_S3_BUCKET_NAME: Joi.string().when('NODE_ENV', {
    is: 'production',
    then: Joi.required(),
    otherwise: Joi.optional().default('local-dev-register-bucket'),
  }),

  // ---- 跨服務 HTTP 整合 ----

  // IAM Service URL（核准時呼叫 POST /users 建立商家帳號）
  IAM_SERVICE_URL: Joi.string().when('NODE_ENV', {
    is: 'production',
    then: Joi.required(),
    otherwise: Joi.optional().default('http://localhost:3001'),
  }),

  // Vendor & Menu Service URL（核准時呼叫 POST /api/v1/admin/vendors 建立商家記錄）
  VENDOR_MENU_SERVICE_URL: Joi.string().when('NODE_ENV', {
    is: 'production',
    then: Joi.required(),
    otherwise: Joi.optional().default('http://localhost:3007'),
  }),

  // 內部 Admin 帳號（用於向 IAM 取得 admin JWT）
  INTERNAL_ADMIN_EMAIL: Joi.string().when('NODE_ENV', {
    is: 'production',
    then: Joi.required(),
    otherwise: Joi.optional().default('admin1@test.com'),
  }),
  INTERNAL_ADMIN_PASSWORD: Joi.string().when('NODE_ENV', {
    is: 'production',
    then: Joi.required(),
    otherwise: Joi.optional().default('admin123'),
  }),

  // ---- SMTP（歡迎信，選填）----
  // 未設定時歡迎信只寫入 log，不影響核准流程
  SMTP_HOST: Joi.string().optional(),
  SMTP_PORT: Joi.number().default(587),
  SMTP_USER: Joi.string().optional(),
  SMTP_PASS: Joi.string().optional(),
  EMAIL_FROM: Joi.string().optional().default('no-reply@ordering-system.local'),
});
