// src/s3/s3.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

// 入駐文件只接受 PDF（營業執照、合約）
const ALLOWED_CONTENT_TYPES: Record<string, string> = {
  'application/pdf': '.pdf',
};

// 上傳 Pre-signed URL 有效期（秒）
const UPLOAD_URL_EXPIRY_SECONDS = 300; // 5 分鐘
// 福委會審核時讀取 PDF 的 Pre-signed URL 有效期（秒）
const DOWNLOAD_URL_EXPIRY_SECONDS = 300; // 5 分鐘

export interface DocumentUploadUrlResult {
  uploadUrl: string; // 前端用來 PUT PDF 的 pre-signed URL
  documentKey: string; // 上傳完成後，存入 DB（pending_vendors.documents_url）的 S3 object key
  expiresIn: number; // URL 有效秒數
}

export interface DocumentDownloadUrlResult {
  downloadUrl: string; // 福委會用來 GET（讀取）PDF 的 pre-signed URL
  expiresIn: number;
}

@Injectable()
export class S3Service {
  private readonly s3Client: S3Client;
  private readonly bucketName: string;
  private readonly region: string;

  constructor(private readonly configService: ConfigService) {
    const configRegion = configService.get<string>('AWS_REGION') || undefined;
    this.region = configRegion ?? '';
    this.bucketName = configService.get<string>('AWS_S3_BUCKET_NAME', '');

    /**
     * AWS SDK Credential Provider Chain（兩種模式自動切換）：
     *   1. 環境變數 AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY → IAM User Access Key 模式
     *   2. EC2 Instance Profile（設好後刪掉 access key 環境變數即自動切換）
     *
     * Region Provider Chain：
     *   - AWS_REGION 有設定 → 使用設定值
     *   - 未設定 → SDK 自動從 EC2 Instance Metadata 取得（Instance Profile 模式）
     */
    this.s3Client = new S3Client(configRegion ? { region: configRegion } : {});
  }

  /**
   * 為入駐營登 PDF 產生一個 pre-signed PUT URL（上傳用）。
   *
   * 流程說明：
   * 1. 後端驗證 contentType 是否合法（僅允許 application/pdf）
   * 2. 生成唯一的 S3 Object Key（vendor-documents/{uuid}.pdf）
   * 3. 向 AWS 申請一個有時效（5 分鐘）的 pre-signed URL，讓前端直接 PUT PDF 到私有 Bucket
   * 4. 回傳 uploadUrl（前端上傳用）與 documentKey（存入 pending_vendors.documents_url）
   *
   * 此 Bucket 設為「私有」，PDF 不會有公開讀取 URL；
   * 福委會審核時需另外呼叫 generateDocumentDownloadUrl 取得短效讀取連結。
   */
  async generateDocumentUploadUrl(contentType: string): Promise<DocumentUploadUrlResult> {
    const ext = ALLOWED_CONTENT_TYPES[contentType];
    if (!ext) {
      throw new BadRequestException(
        `不支援的文件格式。允許的格式：${Object.keys(ALLOWED_CONTENT_TYPES).join(', ')}`,
      );
    }

    // 用 UUID 確保每次 key 唯一，不會覆蓋他人文件
    const documentKey = `vendor-documents/${randomUUID()}${ext}`;

    // PutObjectCommand：限制只能上傳指定 ContentType，防止前端上傳非 PDF
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: documentKey,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn: UPLOAD_URL_EXPIRY_SECONDS,
    });

    return { uploadUrl, documentKey, expiresIn: UPLOAD_URL_EXPIRY_SECONDS };
  }

  /**
   * 為私有 Bucket 中的入駐文件產生一個 pre-signed GET URL（福委會審核讀取用）。
   *
   * 文件存在私有 Bucket，平時無法被公開存取；
   * 只有在福委會審核時，系統才動態生成具時效性（5 分鐘）的讀取連結，確保文件安全性。
   */
  async generateDocumentDownloadUrl(documentKey: string): Promise<DocumentDownloadUrlResult> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: documentKey,
    });

    const downloadUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn: DOWNLOAD_URL_EXPIRY_SECONDS,
    });

    return { downloadUrl, expiresIn: DOWNLOAD_URL_EXPIRY_SECONDS };
  }
}
