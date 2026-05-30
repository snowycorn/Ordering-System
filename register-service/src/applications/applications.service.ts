import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../s3/s3.service';
import { IamClient } from '../integrations/iam.client';
import { VendorMenuClient } from '../integrations/vendor-menu.client';
import { MailerService } from '../integrations/mailer.service';
import { CreateApplicationDto } from './dto/create-application.dto';
import { ReviewApplicationDto } from './dto/reject-application.dto';

@Injectable()
export class ApplicationsService {
  private readonly logger = new Logger(ApplicationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly s3Service: S3Service,
    private readonly iamClient: IamClient,
    private readonly vendorMenuClient: VendorMenuClient,
    private readonly mailerService: MailerService,
  ) {}

  // ---- 外部商家（公開）----

  /**
   * 建立一筆入駐申請，狀態預設 PENDING。
   * 回傳的 id 即「隨機 Key」，申請人後續可憑此查詢審核進度。
   */
  async create(dto: CreateApplicationDto) {
    const pending = await this.prisma.pendingVendor.create({
      data: {
        vendorName: dto.vendorName,
        email: dto.email,
        phone: dto.phone,
        factoryZone: dto.factoryZone,
        documentsKey: dto.documentsKey,
        status: 'PENDING',
      },
    });

    return {
      id: pending.id,
      status: pending.status,
      createdAt: pending.createdAt,
      message: '入駐申請已送出，請保留此 id 以查詢審核進度',
    };
  }

  /**
   * 申請人憑 id（隨機 Key）查詢自己的審核進度。
   * 僅回傳必要欄位，不揭露審核者等內部資訊。
   */
  async getPublicStatus(id: string) {
    const pending = await this.findOrThrow(id);
    return {
      id: pending.id,
      vendorName: pending.vendorName,
      status: pending.status,
      reviewNotes: pending.reviewNotes,
      createdAt: pending.createdAt,
      reviewedAt: pending.reviewedAt,
    };
  }

  // ---- 福委會（管理員）----

  /** 列出申請，可依狀態過濾。 */
  async listForAdmin(status?: string) {
    return this.prisma.pendingVendor.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  /** 取得單筆申請完整內容（含營登 PDF 的短效讀取連結，若有文件）。 */
  async getForAdmin(id: string) {
    const pending = await this.findOrThrow(id);

    let document: { downloadUrl: string; expiresIn: number } | null = null;
    if (pending.documentsKey) {
      document = await this.s3Service.generateDocumentDownloadUrl(pending.documentsKey);
    }

    return { ...pending, document };
  }

  /**
   * 單獨取得營登 PDF 的讀取 Pre-signed URL（福委會審核時動態產生）。
   */
  async getDocumentUrl(id: string) {
    const pending = await this.findOrThrow(id);
    if (!pending.documentsKey) {
      throw new NotFoundException('此申請尚未上傳營登文件');
    }
    return this.s3Service.generateDocumentDownloadUrl(pending.documentsKey);
  }

  /**
   * 核准入駐。
   *
   * 流程（先打下游 HTTP，成功後才寫 DB，確保可安全重試）：
   * 1. 產生臨時密碼
   * 2. 呼叫 IAM 建立 vendor 帳號（409 視為冪等成功）
   * 3. 呼叫 vendor-menu 建立商家記錄
   * 4. 更新 DB status → APPROVED
   * 5. 寄出歡迎信（失敗只記錄，不中斷流程）
   * 6. 回傳核准記錄與 tempPassword（前端可顯示作備用）
   *
   * 步驟 2 或 3 失敗時拋出例外，status 維持 PENDING，福委會可直接重試。
   */
  async approve(id: string, reviewedBy: string | undefined, dto: ReviewApplicationDto) {
    const pending = await this.findOrThrow(id);
    this.assertPending(pending.status);

    // 1. 產生 24 字元 hex 臨時密碼
    const tempPassword = randomBytes(12).toString('hex');

    // 2. IAM：建立 vendor 帳號（失敗時 status 維持 PENDING，可重試），取回數字 userId
    const userId = await this.iamClient.createVendorUser(pending.email, tempPassword);

    // 3. vendor-menu：建立商家記錄並綁定 userId（失敗時 status 維持 PENDING，可重試）
    await this.vendorMenuClient.createVendor(pending.vendorName, pending.factoryZone, userId);

    // 4. 兩個下游都成功後，才寫 DB
    const updated = await this.prisma.pendingVendor.update({
      where: { id },
      data: {
        status: 'APPROVED',
        reviewNotes: dto.reviewNotes,
        reviewedBy: reviewedBy ?? null,
        reviewedAt: new Date(),
      },
    });

    // 5. 寄歡迎信（失敗不影響核准結果，回傳的 tempPassword 可供 admin 備用）
    await this.mailerService.sendWelcomeEmail(pending.email, pending.vendorName, tempPassword);

    // 6. 回傳，含 tempPassword 供前端顯示（信件發送失敗的備用管道）
    return { ...updated, tempPassword };
  }

  /** 駁回入駐申請。 */
  async reject(id: string, reviewedBy: string | undefined, dto: ReviewApplicationDto) {
    const pending = await this.findOrThrow(id);
    this.assertPending(pending.status);

    return this.prisma.pendingVendor.update({
      where: { id },
      data: {
        status: 'REJECTED',
        reviewNotes: dto.reviewNotes,
        reviewedBy: reviewedBy ?? null,
        reviewedAt: new Date(),
      },
    });
  }

  // ---- 共用 ----

  private async findOrThrow(id: string) {
    const pending = await this.prisma.pendingVendor.findUnique({ where: { id } });
    if (!pending) {
      throw new NotFoundException(`找不到 id 為 ${id} 的入駐申請`);
    }
    return pending;
  }

  private assertPending(status: string) {
    if (status !== 'PENDING') {
      throw new ConflictException(`此申請已處理（目前狀態：${status}），無法重複審核`);
    }
  }
}
