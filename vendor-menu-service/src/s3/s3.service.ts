// src/s3/s3.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

// 允許上傳的圖片 MIME types
const ALLOWED_CONTENT_TYPES: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

// Pre-signed URL 有效期（秒）
const PRESIGNED_URL_EXPIRY_SECONDS = 300; // 5 分鐘

export interface UploadUrlResult {
  uploadUrl: string; // 前端用來 PUT 圖片的 pre-signed URL
  imageUrl: string; // 上傳完成後，存入 DB 的公開讀取 URL
  expiresIn: number; // URL 有效秒數
}

@Injectable()
export class S3Service {
  private readonly s3Client: S3Client;
  private readonly bucketName: string;
  private readonly configRegion?: string;
  private readonly cloudfrontDomain?: string;

  constructor(private readonly configService: ConfigService) {
    this.configRegion = configService.get<string>('AWS_REGION') || undefined;
    this.bucketName = configService.get<string>('AWS_S3_BUCKET_NAME', '');
    this.cloudfrontDomain = configService.get<string>('AWS_CLOUDFRONT_DOMAIN');

    /**
     * AWS SDK Credential Provider Chain（兩種模式自動切換）：
     *   1. 環境變數 AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY → IAM User Access Key 模式
     *   2. EC2 Instance Profile（設好 IAM Role 後刪掉 access key 環境變數即自動切換）
     *
     * Region Provider Chain：
     *   - AWS_REGION 有設定 → 使用設定值
     *   - 未設定 → SDK 自動從 EC2 Instance Metadata 取得（Instance Profile 模式）
     */
    this.s3Client = new S3Client(
      this.configRegion ? { region: this.configRegion } : {},
    );
  }

  /** 取得實際使用的 region（lazy resolve，供組裝 imageUrl 用） */
  private async resolveRegion(): Promise<string> {
    if (this.configRegion) return this.configRegion;
    // 未明確設定時，從 SDK 的 region provider 取得（EC2 IMDS）
    return this.s3Client.config.region();
  }

  /**
   * 為菜單圖片產生一個 pre-signed PUT URL。
   *
   * 流程說明：
   * 1. 後端驗證 contentType 是否合法
   * 2. 生成唯一的 S3 Object Key（menu-images/{vendorId}/{uuid}.ext）
   * 3. 向 AWS 申請一個有時效的 pre-signed URL，讓前端可以直接 PUT 圖片到 S3
   * 4. 回傳 uploadUrl（前端上傳用）和 imageUrl（存入 DB 用）
   *
   * 這樣設計的好處：
   * - 圖片流量完全不經過 NestJS 容器，省頻寬、省記憶體
   * - pre-signed URL 有時效（5 分鐘），過期自動失效
   * - S3 Bucket Policy 設為 Public Read，imageUrl 可直接被 CDN 快取
   */
  async generateMenuImageUploadUrl(
    vendorId: string,
    contentType: string,
  ): Promise<UploadUrlResult> {
    const ext = ALLOWED_CONTENT_TYPES[contentType];
    if (!ext) {
      throw new BadRequestException(
        `不支援的圖片格式。允許的格式：${Object.keys(ALLOWED_CONTENT_TYPES).join(', ')}`,
      );
    }

    // 用 UUID 確保每次 key 唯一，不會覆蓋舊圖片
    const objectKey = `menu-images/${vendorId}/${randomUUID()}${ext}`;

    // PutObjectCommand：定義這個 pre-signed URL 允許做什麼操作
    // ContentType 限制只能上傳指定格式，防止前端上傳非圖片檔
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: objectKey,
      ContentType: contentType,
    });

    // getSignedUrl：向 AWS STS 換取帶有簽章的臨時 URL
    const uploadUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn: PRESIGNED_URL_EXPIRY_SECONDS,
    });

    // 組出最終公開讀取的 imageUrl
    // 優先用 CloudFront（CDN 加速、降低 S3 費用）
    // 沒設定 CloudFront 就直接用 S3 URL（lazy resolve region）
    const region = await this.resolveRegion();
    const imageUrl = this.cloudfrontDomain
      ? `https://${this.cloudfrontDomain}/${objectKey}`
      : `https://${this.bucketName}.s3.${region}.amazonaws.com/${objectKey}`;

    return { uploadUrl, imageUrl, expiresIn: PRESIGNED_URL_EXPIRY_SECONDS };
  }
}
