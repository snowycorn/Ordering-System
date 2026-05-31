import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrderInventoryClient } from '../integrations/order-inventory.client';
import { CreateMenuDto } from './dto/create-menu.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';
import { SetDailyQuotaDto } from './dto/set-daily-quota.dto';

// 訂單可預訂的滾動視窗天數：今天(D0) 起算共 7 天，最遠到 D+6
const BOOKING_WINDOW_DAYS = 7;

@Injectable()
export class MenusService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orderInventory: OrderInventoryClient,
  ) {}

  /** Asia/Taipei 今天的 YYYY-MM-DD 字串。 */
  private todayStr(): string {
    return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Taipei' }).split(' ')[0];
  }

  /** 以 baseStr(YYYY-MM-DD) 為基準加 n 天，回傳 YYYY-MM-DD（錨定 UTC 午夜，僅加整日，無 DST 疑慮）。 */
  private addDays(baseStr: string, n: number): string {
    const d = new Date(`${baseStr}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().split('T')[0];
  }

  /**
   * 計算某菜單某日的「有效每日上限」。
   * 規則：取 targetDate <= date 中 targetDate 最大的那筆 DailyQuota.maxQuantity；
   * 若無任何符合的 quota，回退 menu 的 dailyLimit。
   */
  private async effectiveLimit(menuId: string, dailyLimit: number, dateStr: string): Promise<number> {
    const quota = await this.prisma.dailyQuota.findFirst({
      where: { menuId, targetDate: { lte: new Date(dateStr) } },
      orderBy: { targetDate: 'desc' },
    });
    return quota?.maxQuantity ?? dailyLimit;
  }

  /** 推送 [fromStr .. toStr]（含）每一天的有效上限給 order-inventory。 */
  private async pushInventoryRange(
    menuId: string,
    dailyLimit: number,
    fromStr: string,
    toStr: string,
  ): Promise<void> {
    for (let dateStr = fromStr; dateStr <= toStr; dateStr = this.addDays(dateStr, 1)) {
      const limit = await this.effectiveLimit(menuId, dailyLimit, dateStr);
      await this.orderInventory.setInventory(menuId, dateStr, limit);
    }
  }

  /** 把視窗內（今天 D0..D+6）整段重推給 order-inventory（依菜單目前有效上限）。 */
  private async pushBookingWindow(menuId: string, dailyLimit: number): Promise<void> {
    const today = this.todayStr();
    await this.pushInventoryRange(menuId, dailyLimit, today, this.addDays(today, BOOKING_WINDOW_DAYS - 1));
  }

  /** 把視窗內（今天 D0..D+6）的庫存全部歸零（菜單下架時呼叫，強制 order-inventory 額度歸零）。 */
  private async zeroBookingWindow(menuId: string): Promise<void> {
    const today = this.todayStr();
    const end = this.addDays(today, BOOKING_WINDOW_DAYS - 1);
    for (let dateStr = today; dateStr <= end; dateStr = this.addDays(dateStr, 1)) {
      await this.orderInventory.setInventory(menuId, dateStr, 0);
    }
  }

  async create(vendorId: string, createMenuDto: CreateMenuDto) {
    const menu = await this.prisma.menu.create({
      data: {
        vendorId,
        ...createMenuDto,
      },
    });

    // 種未來 7 天（D0..D+6）的庫存到 order-inventory，讓員工可立即下單
    await this.pushBookingWindow(menu.id, menu.dailyLimit);

    return menu;
  }

  async findAllByVendor(vendorId: string) {
    const today = new Date(this.todayStr());
    const menus = await this.prisma.menu.findMany({
      where: { vendorId },
      include: {
        // 帶出「今天生效」的 quota（targetDate <= today 的最新一筆），用來算 effectiveDailyLimit
        dailyQuotas: {
          where: { targetDate: { lte: today } },
          orderBy: { targetDate: 'desc' },
          take: 1,
        },
      },
    });

    // 壓平：effectiveDailyLimit = 今天生效的 quota，否則回退 dailyLimit
    return menus.map(({ dailyQuotas, ...menu }) => ({
      ...menu,
      effectiveDailyLimit: dailyQuotas[0]?.maxQuantity ?? menu.dailyLimit,
    }));
  }

  async update(vendorId: string, menuId: string, updateMenuDto: UpdateMenuDto) {
    // 確保菜單屬於該商家，防止越權操作
    const menu = await this.prisma.menu.findFirst({
      where: { id: menuId, vendorId },
    });

    if (!menu) {
      throw new NotFoundException(`找不到這筆菜單或你沒有權限修改`);
    }

    const updated = await this.prisma.menu.update({
      where: { id: menuId },
      data: updateMenuDto,
    });

    // 同步 order-inventory：下架（true→false）歸零視窗；重新上架（false→true）重推視窗
    if (menu.isActive && !updated.isActive) {
      await this.zeroBookingWindow(menuId);
    } else if (!menu.isActive && updated.isActive) {
      await this.pushBookingWindow(menuId, updated.dailyLimit);
    }

    return updated;
  }

  async remove(vendorId: string, menuId: string) {
    const menu = await this.prisma.menu.findFirst({
      where: { id: menuId, vendorId },
    });

    if (!menu) {
      throw new NotFoundException(`找不到這筆菜單或你沒有權限刪除`);
    }

    // 軟刪除：標記為下架，避免破壞歷史訂單關聯
    const removed = await this.prisma.menu.update({
      where: { id: menuId },
      data: { isActive: false },
    });

    // 強制把 order-inventory 視窗內（今天 D0..D+6）額度歸零，避免下架後仍可被下單
    await this.zeroBookingWindow(menuId);

    return removed;
  }

  async setDailyQuota(vendorId: string, menuId: string, dto: SetDailyQuotaDto) {
    // 阻擋設定過去日期
    const today = this.todayStr();
    if (dto.targetDate < today) {
      throw new BadRequestException('不能設定過去日期的限量配額');
    }

    const menu = await this.prisma.menu.findFirst({
      where: { id: menuId, vendorId },
    });

    if (!menu) {
      throw new NotFoundException(`找不到這筆菜單或你沒有權限修改限量`);
    }

    // 下架的菜單不可設定配額（其視窗庫存已歸零）
    if (!menu.isActive) {
      throw new BadRequestException('菜單已下架，無法設定配額');
    }

    const targetDate = new Date(dto.targetDate);

    // 使用 upsert，如果當天已經設過上限就更新，沒有就新增
    const quota = await this.prisma.dailyQuota.upsert({
      where: {
        menuId_targetDate: {
          menuId,
          targetDate,
        },
      },
      update: {
        maxQuantity: dto.maxQuantity,
      },
      create: {
        menuId,
        targetDate,
        maxQuantity: dto.maxQuantity,
      },
    });

    // quota 影響「targetDate 當天起、之後所有日期」的有效上限，
    // 即時重推視窗內受影響的日期（從 targetDate 或今天起，到 D+6 邊界）。
    const windowEnd = this.addDays(today, BOOKING_WINDOW_DAYS - 1);
    const repushFrom = dto.targetDate > today ? dto.targetDate : today;
    if (repushFrom <= windowEnd) {
      await this.pushInventoryRange(menuId, menu.dailyLimit, repushFrom, windowEnd);
    }

    return quota;
  }
  /**
   * 公開全量菜單查詢（供 Recommendation Service 使用）。
   * 支援依 vendorId 和 isActive 過濾。
   * 回傳資料包含 vendor 基本資料，讓 Recommendation Service 不需要再打一次 vendors API。
   */
  async findAllPublic(vendorId?: string, isActive: boolean = true, tags?: string[]) {
    return this.prisma.menu.findMany({
      where: {
        isActive,
        ...(vendorId ? { vendorId } : {}),
        // AND 語意：菜單須同時包含所有指定 tag
        ...(tags?.length ? { tags: { hasEvery: tags } } : {}),
      },
      select: {
        id: true,
        name: true,
        price: true,
        imageUrl: true,
        dailyLimit: true,
        tags: true,
        isActive: true,
        vendorId: true,
        // 附帶商家基本資訊，避免 Recommendation Service 再打一次 API
        vendor: {
          select: {
            id: true,
            name: true,
            category: true,
            factoryZone: true,
          },
        },
      },
      orderBy: [{ vendorId: 'asc' }, { name: 'asc' }],
    });
  }

  /**
   * 商家查自己的單一菜單（含所有未來日期的 DailyQuota，方便菜單管理頁面呈現）。
   * 越權防護：menuId + vendorId 雙重驗證。
   */
  async findOneByVendor(vendorId: string, menuId: string) {
    const today = new Date(this.todayStr());
    const menu = await this.prisma.menu.findFirst({
      where: { id: menuId, vendorId },
      include: {
        // 回傳今天（含）以後的配額設定，讓商家管理頁可以一眼看到未來排程
        dailyQuotas: {
          where: { targetDate: { gte: today } },
          orderBy: { targetDate: 'asc' },
        },
      },
    });

    if (!menu) {
      throw new NotFoundException(`找不到這筆菜單或你沒有權限存取`);
    }

    // effectiveDailyLimit：今天生效的有效上限（可能來自過去日期、仍在生效中的 quota）
    return {
      ...menu,
      effectiveDailyLimit: await this.effectiveLimit(menuId, menu.dailyLimit, this.todayStr()),
    };
  }

  /**
   * 公開單一菜單查詢（員工查詢特定品項詳情，或 Recommendation Service 用）。
   * 只回傳 isActive = true 的菜單，下架品項回傳 404。
   * 附帶商家基本資訊。
   */
  async findOnePublic(menuId: string) {
    const menu = await this.prisma.menu.findFirst({
      where: { id: menuId, isActive: true },
      select: {
        id: true,
        name: true,
        price: true,
        imageUrl: true,
        dailyLimit: true,
        tags: true,
        isActive: true,
        vendorId: true,
        vendor: {
          select: {
            id: true,
            name: true,
            category: true,
            factoryZone: true,
          },
        },
      },
    });

    if (!menu) {
      throw new NotFoundException(`找不到 ID 為 ${menuId} 的菜單`);
    }
    return menu;
  }
}
