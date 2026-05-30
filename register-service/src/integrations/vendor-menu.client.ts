// src/integrations/vendor-menu.client.ts
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
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
   */
  async createVendor(name: string, factoryZone?: string | null): Promise<void> {
    const body: Record<string, unknown> = { name };
    if (factoryZone) body.factoryZone = factoryZone;

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
      throw new BadRequestException(
        `vendor-menu 建立商家記錄失敗（${res.status}）：${responseBody}`,
      );
    }

    this.logger.log(`vendor-menu 商家記錄已建立：${name}`);
  }
}
