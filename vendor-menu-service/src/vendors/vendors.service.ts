import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';
import { AdminUpdateVendorDto } from './dto/admin-update-vendor.dto';

// 商家狀態列舉（DB status 欄位用字串儲存）
export const VENDOR_STATUS = { ACTIVE: 'ACTIVE', SUSPENDED: 'SUSPENDED' } as const;

// 取台灣時間（UTC+8）的當天日期字串，用於查詢 DailyQuota
function getTaipeiDateString(baseDate?: Date): string {
  const date = baseDate ?? new Date();
  // toLocaleString 換算 UTC+8，取出 YYYY-MM-DD 部分
  const taipeiStr = date.toLocaleString('sv-SE', { timeZone: 'Asia/Taipei' });
  return taipeiStr.split(' ')[0]; // 'YYYY-MM-DD'
}

@Injectable()
export class VendorsService {
  constructor(private readonly prisma: PrismaService) {}

  // ---- 管理員（福委會）----

  /**
   * 建立新商家帳號（僅管理員可用）。
   * 新商家預設狀態為 ACTIVE。
   */
  async create(createVendorDto: CreateVendorDto) {
    try {
      return await this.prisma.vendor.create({
        data: {
          ...createVendorDto,
          status: 'ACTIVE',
        },
      });
    } catch (err) {
      // userId @unique 衝突（P2002）：此 IAM 帳號已綁定商家，回 409 而非 500
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException(
          `此帳號（userId=${createVendorDto.userId}）已綁定商家，無法重複建立`,
        );
      }
      throw err;
    }
  }

  // ---- 商家自管 & 管理員共用 ----

  async findOne(id: string) {
    const vendor = await this.prisma.vendor.findUnique({
      where: { id },
    });
    if (!vendor) {
      throw new NotFoundException(`找不到 ID 為 ${id} 的商家資料`);
    }
    return vendor;
  }

  /**
   * 以 IAM 數字 userId 查商家（供 /me* 自管路由：x-user-id → vendor）。
   */
  async findByUserId(userId: number) {
    const vendor = await this.prisma.vendor.findUnique({
      where: { userId },
    });
    if (!vendor) {
      throw new NotFoundException(`找不到 userId 為 ${userId} 的商家資料`);
    }
    return vendor;
  }

  async update(id: string, updateVendorDto: UpdateVendorDto | AdminUpdateVendorDto) {
    await this.findOne(id);
    return this.prisma.vendor.update({
      where: { id },
      data: updateVendorDto,
    });
  }

  /**
   * 為指定商家的違規點數 +1（管理員專用）。
   * 使用 Prisma 原子 increment，避免並發呼叫時遺失更新。
   */
  async addViolationPoint(id: string) {
    await this.findOne(id);
    return this.prisma.vendor.update({
      where: { id },
      data: { violationPoints: { increment: 1 } },
    });
  }

  /**
   * 停權商家（管理員專用）。記錄停權時間、操作者與原因。
   * 僅改 vendor.status，菜單 isActive 不動（單一真實來源）；庫存歸零由 MenusService 編排。
   */
  async suspend(id: string, suspendedBy: number | undefined, reason: string) {
    await this.findOne(id);
    return this.prisma.vendor.update({
      where: { id },
      data: {
        status: VENDOR_STATUS.SUSPENDED,
        suspendedAt: new Date(),
        suspendedBy: suspendedBy ?? null,
        suspendReason: reason,
      },
    });
  }

  /**
   * 復權商家（管理員專用）。狀態還原 ACTIVE 並清空稽核欄位。
   * 菜單原本的 isActive 自然保留，無需還原。
   */
  async reactivate(id: string) {
    await this.findOne(id);
    return this.prisma.vendor.update({
      where: { id },
      data: {
        status: VENDOR_STATUS.ACTIVE,
        suspendedAt: null,
        suspendedBy: null,
        suspendReason: null,
      },
    });
  }

  // ---- 公開查詢（員工用）----

  /**
   * 查詢所有上架中的商家列表。
   * 可依 factoryZone 過濾，讓員工只看到自己廠區的商家。
   */
  async findAll(factoryZone?: string) {
    return this.prisma.vendor.findMany({
      where: {
        status: 'ACTIVE',
        // factoryZone 有傳才過濾（比對商家 factoryZones 陣列是否含此廠區），沒傳就返回全部
        ...(factoryZone ? { factoryZones: { has: factoryZone } } : {}),
      },
      select: {
        id: true,
        name: true,
        category: true,
        description: true,
        imageUrl: true,
        factoryZones: true,
        status: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * 查詢指定商家在特定日期的菜單，並附上當日配額資訊。
   *
   * 回傳每道菜的：
   * - 基本資訊（名稱、價格、圖片）
   * - dailyLimit：菜單預設每日限量
   * - todayMaxQuantity：當日生效的 DailyQuota 上限（null = 使用 dailyLimit）
   *
   * DailyQuota 語意：一筆 targetDate=T 代表「T 當天起、之後所有日期」皆套用該 maxQuantity，
   * 故這裡取 targetDate <= date 中最新的一筆，而非精確日期比對。
   * 注意：實際剩餘庫存由 Order Service 的 Redis 管理，這裡只回傳「上限」資訊。
   */
  async findVendorMenus(vendorId: string, dateString?: string) {
    // 先確認商家存在；停權商家對公開端隱藏（回 404）
    const vendor = await this.findOne(vendorId);
    if (vendor.status !== VENDOR_STATUS.ACTIVE) {
      throw new NotFoundException(`找不到 ID 為 ${vendorId} 的商家資料`);
    }

    const targetDateStr = dateString ?? getTaipeiDateString();
    const targetDate = new Date(targetDateStr); // midnight UTC of that date

    const menus = await this.prisma.menu.findMany({
      where: { vendorId, isActive: true },
      include: {
        // 撈出「該日生效」的 DailyQuota（targetDate <= 該日的最新一筆），避免 N+1
        dailyQuotas: {
          where: { targetDate: { lte: targetDate } },
          orderBy: { targetDate: 'desc' },
          take: 1,
        },
      },
      orderBy: { name: 'asc' },
    });

    // 壓平回傳結構，讓前端不用自己 parse nested array
    return menus.map((menu) => ({
      id: menu.id,
      name: menu.name,
      price: menu.price,
      imageUrl: menu.imageUrl,
      dailyLimit: menu.dailyLimit,          // 預設限量
      tags: menu.tags,                      // 菜單標籤（英文 code）
      todayMaxQuantity: menu.dailyQuotas[0]?.maxQuantity ?? null, // 該日生效的 override
      date: targetDateStr,
      isActive: menu.isActive,
    }));
  }
}
