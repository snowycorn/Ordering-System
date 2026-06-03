// src/s3/s3.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Service } from './s3.service';

// --- Mock AWS SDK（避免 unit test 打真實 AWS）---
const mockGetSignedUrl = jest.fn();

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({})),
  PutObjectCommand: jest.fn().mockImplementation((input) => ({ ...input })),
}));

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: (...args: unknown[]) => mockGetSignedUrl(...args),
}));

// ---- Helper：建立 ConfigService mock ----
function buildConfigService(overrides: Record<string, string | undefined> = {}): ConfigService {
  const defaults: Record<string, string | undefined> = {
    AWS_REGION: 'ap-northeast-1',
    AWS_S3_BUCKET_NAME: 'test-bucket',
    AWS_CLOUDFRONT_DOMAIN: undefined,
    ...overrides,
  };
  return {
    get: jest.fn((key: string, defaultVal?: unknown) => defaults[key] ?? defaultVal),
  } as unknown as ConfigService;
}

describe('S3Service', () => {
  const VENDOR_ID = 'vendor-uuid-123';
  const FAKE_PRESIGNED_URL =
    'https://test-bucket.s3.ap-northeast-1.amazonaws.com/menu-images/vendor-uuid-123/some-uuid.jpg?X-Amz-Signature=abc';

  beforeEach(() => {
    mockGetSignedUrl.mockResolvedValue(FAKE_PRESIGNED_URL);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ---- 建立 Service 的 helper ----
  async function createService(configOverrides?: Record<string, string | undefined>): Promise<S3Service> {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        S3Service,
        { provide: ConfigService, useValue: buildConfigService(configOverrides) },
      ],
    }).compile();
    return module.get<S3Service>(S3Service);
  }

  // ----------------------------------------------------------------
  // 正常流程
  // ----------------------------------------------------------------
  describe('generateMenuImageUploadUrl', () => {
    it('應回傳包含 uploadUrl、imageUrl、expiresIn 的物件', async () => {
      const service = await createService();
      const result = await service.generateMenuImageUploadUrl(VENDOR_ID, 'image/jpeg');

      expect(result).toMatchObject({
        uploadUrl: FAKE_PRESIGNED_URL,
        expiresIn: 300,
      });
      expect(result.imageUrl).toBeDefined();
    });

    it('expiresIn 應為 300 秒', async () => {
      const service = await createService();
      const result = await service.generateMenuImageUploadUrl(VENDOR_ID, 'image/jpeg');
      expect(result.expiresIn).toBe(300);
    });

    it('getSignedUrl 應帶入正確的 expiresIn', async () => {
      const service = await createService();
      await service.generateMenuImageUploadUrl(VENDOR_ID, 'image/jpeg');

      // 第三個參數是 options，確認 expiresIn 正確傳入
      expect(mockGetSignedUrl).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ expiresIn: 300 }),
      );
    });

    // ---- Object Key 格式 ----
    it.each([
      ['image/jpeg', '.jpg'],
      ['image/png', '.png'],
      ['image/webp', '.webp'],
    ])('contentType %s 應產生副檔名 %s 的 object key', async (contentType, ext) => {
      const service = await createService();
      await service.generateMenuImageUploadUrl(VENDOR_ID, contentType);

      // 取得 PutObjectCommand 被呼叫時的 Key 參數
      const { PutObjectCommand } = jest.requireMock('@aws-sdk/client-s3');
      const callArg = PutObjectCommand.mock.calls.at(-1)[0];

      expect(callArg.Key).toMatch(
        new RegExp(`^menu-images/${VENDOR_ID}/[0-9a-f-]{36}\\${ext}$`),
      );
      expect(callArg.ContentType).toBe(contentType);
      expect(callArg.Bucket).toBe('test-bucket');
    });

    // ---- imageUrl 格式：S3 直連 vs CloudFront ----
    it('未設定 CloudFront 時，imageUrl 應使用 S3 直連格式', async () => {
      const service = await createService({ AWS_CLOUDFRONT_DOMAIN: undefined });
      const result = await service.generateMenuImageUploadUrl(VENDOR_ID, 'image/jpeg');

      expect(result.imageUrl).toMatch(
        /^https:\/\/test-bucket\.s3\.ap-northeast-1\.amazonaws\.com\/menu-images\/.+\.jpg$/,
      );
    });

    it('設定 CloudFront 時，imageUrl 應使用 CloudFront 格式', async () => {
      const service = await createService({ AWS_CLOUDFRONT_DOMAIN: 'd1234abcd.cloudfront.net' });
      const result = await service.generateMenuImageUploadUrl(VENDOR_ID, 'image/jpeg');

      expect(result.imageUrl).toMatch(
        /^https:\/\/d1234abcd\.cloudfront\.net\/menu-images\/.+\.jpg$/,
      );
    });

    it('每次呼叫應產生不重複的 object key（UUID 唯一性）', async () => {
      const service = await createService();
      const { PutObjectCommand } = jest.requireMock('@aws-sdk/client-s3');

      await service.generateMenuImageUploadUrl(VENDOR_ID, 'image/jpeg');
      await service.generateMenuImageUploadUrl(VENDOR_ID, 'image/jpeg');

      const key1: string = PutObjectCommand.mock.calls[0][0].Key;
      const key2: string = PutObjectCommand.mock.calls[1][0].Key;
      expect(key1).not.toBe(key2);
    });
  });

  // ----------------------------------------------------------------
  // 商家圖片（vendor-images/ 前綴）
  // ----------------------------------------------------------------
  describe('generateVendorImageUploadUrl', () => {
    it('object key 應以 vendor-images/{vendorId}/ 為前綴', async () => {
      const service = await createService();
      await service.generateVendorImageUploadUrl(VENDOR_ID, 'image/png');

      const { PutObjectCommand } = jest.requireMock('@aws-sdk/client-s3');
      const callArg = PutObjectCommand.mock.calls.at(-1)[0];

      expect(callArg.Key).toMatch(
        new RegExp(`^vendor-images/${VENDOR_ID}/[0-9a-f-]{36}\\.png$`),
      );
      expect(callArg.ContentType).toBe('image/png');
    });

    it('應回傳含 vendor-images 路徑的 imageUrl 與 expiresIn=300', async () => {
      const service = await createService();
      const result = await service.generateVendorImageUploadUrl(
        VENDOR_ID,
        'image/jpeg',
      );

      expect(result).toMatchObject({
        uploadUrl: FAKE_PRESIGNED_URL,
        expiresIn: 300,
      });
      expect(result.imageUrl).toMatch(/\/vendor-images\/.+\.jpg$/);
    });

    it('不支援的 MIME type 應拋出 BadRequestException', async () => {
      const service = await createService();
      await expect(
        service.generateVendorImageUploadUrl(VENDOR_ID, 'image/gif'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ----------------------------------------------------------------
  // 非法輸入
  // ----------------------------------------------------------------
  describe('contentType 驗證', () => {
    it('不支援的 MIME type 應拋出 BadRequestException', async () => {
      const service = await createService();

      await expect(
        service.generateMenuImageUploadUrl(VENDOR_ID, 'image/gif'),
      ).rejects.toThrow(BadRequestException);
    });

    it('非圖片 MIME type 應拋出 BadRequestException', async () => {
      const service = await createService();

      await expect(
        service.generateMenuImageUploadUrl(VENDOR_ID, 'application/pdf'),
      ).rejects.toThrow(BadRequestException);
    });

    it('空字串 contentType 應拋出 BadRequestException', async () => {
      const service = await createService();

      await expect(
        service.generateMenuImageUploadUrl(VENDOR_ID, ''),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
