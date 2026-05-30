// src/integrations/iam.client.ts
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
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

    const data = (await res.json()) as { token: string };
    this.cachedToken = data.token;
    // IAM token TTL 預設 24h；快取 23.5h
    this.tokenExpiresAt = Date.now() + 23.5 * 60 * 60 * 1000;
    return this.cachedToken;
  }

  /**
   * 在 IAM 建立 role='vendor' 的帳號。
   * - 若 email 已存在（409）→ 視為冪等成功（帳號已建，允許 approve 重試）
   * - 其他錯誤 → 丟出，讓 approve() 中斷並維持 PENDING 狀態
   */
  async createVendorUser(email: string, password: string): Promise<void> {
    const token = await this.getAdminToken();

    const res = await fetch(`${this.iamUrl}/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ email, password, role: 'vendor' }),
    });

    if (res.status === 409) {
      this.logger.warn(`IAM 帳號 ${email} 已存在，視為冪等成功`);
      return;
    }

    if (!res.ok) {
      const body = await res.text();
      throw new BadRequestException(`IAM 建立商家帳號失敗（${res.status}）：${body}`);
    }

    this.logger.log(`IAM 商家帳號已建立：${email}`);
  }
}
