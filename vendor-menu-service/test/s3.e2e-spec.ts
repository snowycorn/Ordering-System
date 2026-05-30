// test/s3.e2e-spec.ts
//
// Integration test：使用真實 AWS 憑證，驗證 S3 連線與圖片上傳完整流程。
// 執行前請確認 .env 中 AWS_* 變數已設定正確。
//
// 執行指令：npm run test:e2e -- --testPathPattern=s3
//
import 'dotenv/config';
import { S3Client, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';

// ---- 被測試的 service（直接 new，不走 NestJS DI，避免 e2e 啟動整個 App）----
import { S3Service } from '../src/s3/s3.service';
import { ConfigService } from '@nestjs/config';

// ---- 測試用的 1x1 白色 PNG（base64）----
const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg==';
const TINY_PNG_BUFFER = Buffer.from(TINY_PNG_BASE64, 'base64');

// ---- 從環境變數讀取 AWS 設定 ----
const REGION = process.env.AWS_REGION ?? 'ap-northeast-1';
const BUCKET = process.env.AWS_S3_BUCKET_NAME ?? '';
const VENDOR_ID = 'integration-test-vendor';

// ---- 真實 S3Client（for 驗證和清理用）----
const s3Client = new S3Client({ region: REGION });

// ---- Mock ConfigService 回傳真實 .env 值 ----
function buildRealConfigService(): ConfigService {
  const config: Record<string, string | undefined> = {
    AWS_REGION: REGION,
    AWS_S3_BUCKET_NAME: BUCKET,
    AWS_CLOUDFRONT_DOMAIN: process.env.AWS_CLOUDFRONT_DOMAIN,
  };
  return {
    get: jest.fn((key: string, defaultVal?: unknown) => config[key] ?? defaultVal),
  } as unknown as ConfigService;
}

describe('S3 Integration Test（真實 AWS 連線）', () => {
  let service: S3Service;
  const uploadedKeys: string[] = []; // 記錄上傳的 key，afterAll 清理用

  beforeAll(() => {
    // 前置條件：必須有 bucket 設定
    if (!BUCKET) {
      throw new Error('AWS_S3_BUCKET_NAME 未設定，請在 .env 中填入');
    }
    service = new S3Service(buildRealConfigService());
  });

  afterAll(async () => {
    // 清理所有在測試中上傳的 S3 物件，避免留下垃圾資料
    const deletions = uploadedKeys.map((key) =>
      s3Client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key })),
    );
    await Promise.allSettled(deletions);
    console.log(`[Cleanup] 已刪除 ${uploadedKeys.length} 個測試物件`);
  });

  // ----------------------------------------------------------------
  // 1. Pre-signed URL 結構驗證（不打網路，只驗 URL 格式）
  // ----------------------------------------------------------------
  describe('generateMenuImageUploadUrl — URL 結構', () => {
    it('應回傳合法的 HTTPS pre-signed URL', async () => {
      const result = await service.generateMenuImageUploadUrl(VENDOR_ID, 'image/jpeg');

      expect(result.uploadUrl).toMatch(/^https:\/\//);
      // AWS pre-signed URL 必定包含 X-Amz-Signature
      expect(result.uploadUrl).toContain('X-Amz-Signature');
    });

    it('uploadUrl 應指向正確的 bucket 和 key prefix', async () => {
      const result = await service.generateMenuImageUploadUrl(VENDOR_ID, 'image/png');

      // URL 中應包含 bucket 名稱和 vendor 路徑
      expect(result.uploadUrl).toContain(BUCKET);
      expect(result.uploadUrl).toContain(`menu-images/${VENDOR_ID}/`);
    });

    it('imageUrl 應指向正確的 S3 region endpoint', async () => {
      const result = await service.generateMenuImageUploadUrl(VENDOR_ID, 'image/jpeg');

      // 沒設 CloudFront 的情況下，應為 S3 直連 URL
      if (!process.env.AWS_CLOUDFRONT_DOMAIN) {
        expect(result.imageUrl).toContain(`${BUCKET}.s3.${REGION}.amazonaws.com`);
        expect(result.imageUrl).toContain(`menu-images/${VENDOR_ID}/`);
        expect(result.imageUrl).toMatch(/\.jpg$/);
      }
    });

    it('expiresIn 應為 300 秒', async () => {
      const result = await service.generateMenuImageUploadUrl(VENDOR_ID, 'image/jpeg');
      expect(result.expiresIn).toBe(300);
    });
  });

  // ----------------------------------------------------------------
  // 2. 真實上傳流程（PUT to pre-signed URL）
  // ----------------------------------------------------------------
  describe('S3 實際上傳', () => {
    it('應能透過 pre-signed URL 成功上傳圖片（HTTP 200）', async () => {
      const result = await service.generateMenuImageUploadUrl(VENDOR_ID, 'image/png');

      // 從 imageUrl 解析 objectKey 供後續清理
      const url = new URL(result.imageUrl);
      const objectKey = url.pathname.slice(1); // 去掉開頭的 /
      uploadedKeys.push(objectKey);

      // 用 fetch 對 pre-signed URL 發 PUT 請求，帶入測試圖片
      const response = await fetch(result.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'image/png' },
        body: TINY_PNG_BUFFER,
      });

      expect(response.status).toBe(200);
    });

    it('上傳後 S3 物件應存在（HeadObject 驗證）', async () => {
      const result = await service.generateMenuImageUploadUrl(VENDOR_ID, 'image/jpeg');

      const url = new URL(result.imageUrl);
      const objectKey = url.pathname.slice(1);
      uploadedKeys.push(objectKey);

      // PUT 上傳
      await fetch(result.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'image/jpeg' },
        body: TINY_PNG_BUFFER,
      });

      // 用 HeadObjectCommand 確認物件確實存在於 S3
      const head = await s3Client.send(
        new HeadObjectCommand({ Bucket: BUCKET, Key: objectKey }),
      );

      expect(head.$metadata.httpStatusCode).toBe(200);
      expect(head.ContentType).toBe('image/jpeg');
    });

    it('使用已過期的 pre-signed URL 上傳應失敗（403）', async () => {
      // 構造一個刻意損壞簽章的 URL 來模擬過期/無效情境
      const result = await service.generateMenuImageUploadUrl(VENDOR_ID, 'image/jpeg');
      const corruptedUrl = result.uploadUrl.replace('X-Amz-Signature=', 'X-Amz-Signature=INVALID');

      const response = await fetch(corruptedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'image/jpeg' },
        body: TINY_PNG_BUFFER,
      });

      // S3 應拒絕（403 Forbidden 或 400 Bad Request）
      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });

  // ----------------------------------------------------------------
  // 3. 錯誤處理（與 unit test 互補，驗證真實環境下的錯誤行為）
  // ----------------------------------------------------------------
  describe('錯誤處理', () => {
    it('不支援的 contentType 應在服務層拋出錯誤，不會打到 AWS', async () => {
      await expect(
        service.generateMenuImageUploadUrl(VENDOR_ID, 'video/mp4'),
      ).rejects.toThrow('不支援的圖片格式');
    });
  });
});
