// src/integrations/iam.client.ts
import {
  Injectable,
  Logger,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * IAM Service HTTP client。
 *
 * 照 recommendation service 的 getAdminToken() 模式：
 * 啟動時（或 token 過期時）以 INTERNAL_ADMIN_EMAIL/PASSWORD 登入 IAM，
 * 快取 admin JWT 23.5 小時，後續呼叫直接帶入 Authorization header。
 */
@Injectable()
export class IamClient {
  private readonly logger = new Logger(IamClient.name);
  private readonly iamUrl: string;
  private readonly adminEmail: string;
  private readonly adminPassword: string;

  private cachedToken?: string;
  private tokenExpiresAt = 0; // Unix ms
  // 直連 IAM（繞過 Kong）時，需自行補上 Gateway 平常注入的身份 header。
  // 由 /auth/login 回應取得 admin 的 userId/role/email 後快取。
  private adminIdentity?: { userId: number; role: string; email: string };

  constructor(private readonly config: ConfigService) {
    this.iamUrl = this.config.get<string>('IAM_SERVICE_URL', 'http://localhost:3001');
    this.adminEmail = this.config.get<string>('INTERNAL_ADMIN_EMAIL', '');
    this.adminPassword = this.config.get<string>('INTERNAL_ADMIN_PASSWORD', '');
  }

  /** 取得（或從快取讀取）admin JWT。 */
  private async getAdminToken(): Promise<string> {
    // 快取有效時直接回傳（提前 5 分鐘過期以保安全邊際）
    if (this.cachedToken && Date.now() < this.tokenExpiresAt - 5 * 60 * 1000) {
      return this.cachedToken;
    }

    this.logger.log('向 IAM 取得 admin token...');
    const res = await fetch(`${this.iamUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: this.adminEmail, password: this.adminPassword }),
    });

    if (!res.ok) {
      throw new BadRequestException(
        `IAM 登入失敗（${res.status}）：請確認 INTERNAL_ADMIN_EMAIL/PASSWORD 設定`,
      );
    }

    const data = (await res.json()) as {
      token: string;
      userId: number;
      role: string;
      email?: string;
    };
    this.cachedToken = data.token;
    this.adminIdentity = {
      userId: data.userId,
      role: data.role,
      email: data.email ?? this.adminEmail,
    };
    // IAM token TTL 預設 24h；快取 23.5h
    this.tokenExpiresAt = Date.now() + 23.5 * 60 * 60 * 1000;
    return this.cachedToken;
  }

  /**
   * 直連 IAM 受保護端點時，補上 Gateway 平常注入的身份 header。
   * IAM 的 authenticate middleware 需要 X-User-Id / X-User-Role；
   * authorize("admin") 端點還要求 X-User-Role === 'admin'。
   */
  private gatewayHeaders(token: string): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'X-User-Id': String(this.adminIdentity?.userId ?? ''),
      'X-User-Role': this.adminIdentity?.role ?? 'admin',
      'X-User-Email': this.adminIdentity?.email ?? this.adminEmail,
    };
  }

  /**
   * 在 IAM 建立 role='vendor' 的帳號，回傳該帳號的數字 userId。
   * - 201 → 解析回傳的 { id }
   * - 409（email 已存在）→ 丟 ConflictException：此 email 已是商家帳號。
   *   核准流程採補償式 saga，失敗時會刪除已建的帳號，不會留下半成品，
   *   因此這裡的 409 必為「真重複」，直接擋下而非當成冪等重試。
   * - 其他錯誤 → 丟出，讓 approve() 中斷並維持 PENDING 狀態
   */
  async createVendorUser(email: string, password: string): Promise<number> {
    const token = await this.getAdminToken();

    const res = await fetch(`${this.iamUrl}/users`, {
      method: 'POST',
      headers: this.gatewayHeaders(token),
      body: JSON.stringify({ email, password, role: 'vendor' }),
    });

    if (res.status === 409) {
      throw new ConflictException(`此 email 已是 IAM 帳號，無法重複建立：${email}`);
    }

    if (!res.ok) {
      const body = await res.text();
      throw new BadRequestException(`IAM 建立商家帳號失敗（${res.status}）：${body}`);
    }

    const created = (await res.json()) as { id: number };
    this.logger.log(`IAM 商家帳號已建立：${email}（userId=${created.id}）`);
    return created.id;
  }

  /**
   * 刪除 IAM 帳號（補償用）：approve 流程中 vendor-menu 建立失敗時，
   * 回滾先前在 IAM 建立的 vendor 帳號，避免留下孤兒帳號。
   */
  async deleteUser(userId: number): Promise<void> {
    const token = await this.getAdminToken();

    const res = await fetch(`${this.iamUrl}/users/${userId}`, {
      method: 'DELETE',
      headers: this.gatewayHeaders(token),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new BadRequestException(`IAM 刪除帳號失敗（${res.status}）：${body}`);
    }

    this.logger.log(`IAM 帳號已刪除：userId=${userId}`);
  }
}
