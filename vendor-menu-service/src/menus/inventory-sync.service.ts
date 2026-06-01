// src/menus/inventory-sync.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { OrderInventoryClient } from '../integrations/order-inventory.client';

// 與 MenusService 一致的滾動視窗天數
const BOOKING_WINDOW_DAYS = 7;

/**
 * 每日庫存推進 cron：維持「未來 7 天」的滾動視窗。
 * 建立菜單時已種 D0..D+6；每天凌晨把新的邊界日 D+6 種給 order-inventory。
 */
@Injectable()
export class InventorySyncService {
  private readonly logger = new Logger(InventorySyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly orderInventory: OrderInventoryClient,
  ) {}

  @Cron('0 1 * * *', { timeZone: 'Asia/Taipei' })
  async pushRollingBoundary(): Promise<void> {
    // 計算邊界日 D+6（Asia/Taipei today 加 BOOKING_WINDOW_DAYS-1 天）
    const today = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Taipei' }).split(' ')[0];
    const boundary = new Date(`${today}T00:00:00Z`);
    boundary.setUTCDate(boundary.getUTCDate() + BOOKING_WINDOW_DAYS - 1);
    const boundaryStr = boundary.toISOString().split('T')[0];

    // 僅推進「上架中且商家未停權」的菜單，避免把停權商家的庫存重新 push 回去
    const menus = await this.prisma.menu.findMany({
      where: { isActive: true, vendor: { is: { status: 'ACTIVE' } } },
    });
    this.logger.log(`每日庫存推進：為 ${menus.length} 個菜單種 ${boundaryStr} 的庫存`);

    for (const menu of menus) {
      const quota = await this.prisma.dailyQuota.findFirst({
        where: { menuId: menu.id, targetDate: { lte: new Date(boundaryStr) } },
        orderBy: { targetDate: 'desc' },
      });
      const limit = quota?.maxQuantity ?? menu.dailyLimit;
      await this.orderInventory.setInventory(menu.id, boundaryStr, limit);
    }
  }
}
