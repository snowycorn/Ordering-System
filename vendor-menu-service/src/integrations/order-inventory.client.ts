// src/integrations/order-inventory.client.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Order-Inventory Service HTTP client（直連，繞過 Kong）。
 *
 * order-inventory 採 header-first 驗證（app/core/auth.py）：只要帶
 * X-User-Id（可解析為 int）+ X-User-Role 即直接信任，set inventory 需 role 為 vendor/admin。
 * 故這裡固定帶 X-User-Role: admin + INTERNAL_ADMIN_USER_ID，不需 JWT。
 *
 * 推送庫存採 best-effort：失敗只記 log、不拋，避免拖垮建立菜單 / cron 整批流程。
 */
@Injectable()
export class OrderInventoryClient {
  private readonly logger = new Logger(OrderInventoryClient.name);
  private readonly baseUrl: string;
  private readonly adminUserId: string;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = this.config.get<string>('ORDER_INVENTORY_SERVICE_URL', '');
    this.adminUserId = String(this.config.get<number>('INTERNAL_ADMIN_USER_ID', 0));
  }

  /**
   * 種 / 覆寫某菜單某日的每日庫存上限。
   * order-inventory 新版 set_inventory 會依 sold_quantity 計算 remaining，
   * 上限低於已售時自動取消尾端訂單，故覆寫對任何日期皆安全。
   */
  async setInventory(menuId: string, date: string, quantity: number): Promise<void> {
    try {
      const res = await fetch(`${this.baseUrl}/inventory/${menuId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Role': 'admin',
          'X-User-Id': this.adminUserId,
        },
        body: JSON.stringify({ date, quantity }),
      });

      if (!res.ok) {
        const body = await res.text();
        this.logger.warn(
          `推送庫存失敗（${res.status}）menu=${menuId} date=${date} qty=${quantity}：${body}`,
        );
        return;
      }

      this.logger.log(`已推送庫存 menu=${menuId} date=${date} qty=${quantity}`);
    } catch (err) {
      this.logger.warn(
        `推送庫存錯誤 menu=${menuId} date=${date} qty=${quantity}：${(err as Error).message}`,
      );
    }
  }
}
