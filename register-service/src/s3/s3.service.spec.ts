// src/s3/s3.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Mock before importing S3Service so the module picks up the mock
jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://s3.example.com/presigned-url'),
}));

import { S3Service } from './s3.service';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const getSignedUrlMock = getSignedUrl as jest.MockedFunction<typeof getSignedUrl>;

describe('S3Service', () => {
  let service: S3Service;

  beforeEach(async () => {
    getSignedUrlMock.mockResolvedValue('https://s3.example.com/presigned-url');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        S3Service,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, defaultValue?: string) => {
              const map: Record<string, string> = {
                AWS_REGION: 'ap-northeast-1',
                AWS_S3_BUCKET_NAME: 'test-bucket',
              };
              return map[key] ?? defaultValue;
            },
          },
        },
      ],
    }).compile();

    service = module.get(S3Service);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ── generateDocumentUploadUrl() ───────────────────────────────────────────

  describe('generateDocumentUploadUrl()', () => {
    it('application/pdf → 回傳 { uploadUrl, documentKey, expiresIn: 300 }', async () => {
      const result = await service.generateDocumentUploadUrl('application/pdf');
      expect(result.uploadUrl).toBe('https://s3.example.com/presigned-url');
      expect(result.documentKey).toMatch(/^vendor-documents\/.+\.pdf$/);
      expect(result.expiresIn).toBe(300);
    });

    it('documentKey 格式符合 vendor-documents/{uuid}.pdf', async () => {
      const result = await service.generateDocumentUploadUrl('application/pdf');
      // UUID v4 pattern
      expect(result.documentKey).toMatch(
        /^vendor-documents\/[0-9a-f-]{36}\.pdf$/,
      );
    });

    it('每次呼叫產生不同的 documentKey（UUID 唯一性）', async () => {
      const r1 = await service.generateDocumentUploadUrl('application/pdf');
      const r2 = await service.generateDocumentUploadUrl('application/pdf');
      expect(r1.documentKey).not.toBe(r2.documentKey);
    });

    it('非 PDF（image/png）→ BadRequestException', async () => {
      await expect(service.generateDocumentUploadUrl('image/png')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('空字串 → BadRequestException', async () => {
      await expect(service.generateDocumentUploadUrl('')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('呼叫 getSignedUrl 時傳入正確的 bucket 與 ContentType', async () => {
      await service.generateDocumentUploadUrl('application/pdf');
      expect(getSignedUrlMock).toHaveBeenCalledTimes(1);
      // The second argument is a PutObjectCommand; check it was called with something
      expect(getSignedUrlMock).toHaveBeenCalledWith(
        expect.anything(), // S3Client
        expect.anything(), // PutObjectCommand
        expect.objectContaining({ expiresIn: 300 }),
      );
    });
  });

  // ── generateDocumentDownloadUrl() ─────────────────────────────────────────

  describe('generateDocumentDownloadUrl()', () => {
    it('正常呼叫 → 回傳 { downloadUrl, expiresIn: 300 }', async () => {
      const result = await service.generateDocumentDownloadUrl(
        'vendor-documents/abc123.pdf',
      );
      expect(result.downloadUrl).toBe('https://s3.example.com/presigned-url');
      expect(result.expiresIn).toBe(300);
    });

    it('呼叫 getSignedUrl 時帶 expiresIn: 300', async () => {
      await service.generateDocumentDownloadUrl('vendor-documents/abc.pdf');
      expect(getSignedUrlMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ expiresIn: 300 }),
      );
    });
  });
});
