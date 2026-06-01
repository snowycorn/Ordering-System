// src/integrations/vendor-menu.client.ts
import {
  Injectable,
  Logger,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Vendor & Menu Service HTTP client。
 *
 * 內部直呼 vendor-menu-service，繞過 Kong。
 * vendor-menu 的 RolesGuard 只檢查 x-user-role header（由 Gateway 注入），
 * 內部呼叫直接帶 x-user-role: admin 即可通過。
 */
@Injectable()
export class VendorMenuClient {
  private readonly logger = new Logger(VendorMenuClient.name);
  private readonly vendorMenuUrl: string;

  constructor(private readonly config: ConfigService) {
    this.vendorMenuUrl = this.config.get<string>(
      'VENDOR_MENU_SERVICE_URL',
      'http://localhost:3007',
    );
  }

  /**
   * 在 vendor-menu-service 建立商家記錄（對應 vendors 表）。
   * 直接呼叫 POST /api/v1/admin/vendors，帶 x-user-role: admin header。
   * userId：IAM 數字 userId，寫進 Vendor.userId 供商家自管 /me* 路由解析。
   */
  async createVendor(
    name: string,
    factoryZones: string[] | null | undefined,
    userId: number,
  ): Promise<void> {
    const body: Record<string, unknown> = { name, userId };
    if (factoryZones?.length) body.factoryZones = factoryZones;

    const res = await fetch(`${this.vendorMenuUrl}/api/v1/admin/vendors`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-role': 'admin', // 內部呼叫，RolesGuard 只看此 header
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const responseBody = await res.text();
      // 409：該 userId 已綁定商家（email 早已核准過）→ 透傳為 Conflict，
      // 讓 approve 回明確的「此帳號已有商家」而非籠統的 400。
      if (res.status === 409) {
        throw new ConflictException(
          `此 email 已核准過、該帳號已綁定商家：${responseBody}`,
        );
      }
      throw new BadRequestException(
        `vendor-menu 建立商家記錄失敗（${res.status}）：${responseBody}`,
      );
    }

    this.logger.log(`vendor-menu 商家記錄已建立：${name}`);
  }
}
