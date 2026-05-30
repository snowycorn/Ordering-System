import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMenuDto } from './dto/create-menu.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';
import { SetDailyQuotaDto } from './dto/set-daily-quota.dto';

@Injectable()
export class MenusService {
  constructor(private readonly prisma: PrismaService) {}

  async create(vendorId: string, createMenuDto: CreateMenuDto) {
    return this.prisma.menu.create({
      data: {
        vendorId,
        ...createMenuDto,
      },
    });
  }

  async findAllByVendor(vendorId: string) {
    return this.prisma.menu.findMany({
      where: { vendorId },
    });
  }

  async update(vendorId: string, menuId: string, updateMenuDto: UpdateMenuDto) {
    // 確保菜單屬於該商家，防止越權操作
    const menu = await this.prisma.menu.findFirst({
      where: { id: menuId, vendorId },
    });

    if (!menu) {
      throw new NotFoundException(`找不到這筆菜單或你沒有權限修改`);
    }

    return this.prisma.menu.update({
      where: { id: menuId },
      data: updateMenuDto,
    });
  }

  async remove(vendorId: string, menuId: string) {
    const menu = await this.prisma.menu.findFirst({
      where: { id: menuId, vendorId },
    });

    if (!menu) {
      throw new NotFoundException(`找不到這筆菜單或你沒有權限刪除`);
    }

    // 軟刪除：標記為下架，避免破壞歷史訂單關聯
    return this.prisma.menu.update({
      where: { id: menuId },
      data: { isActive: false },
    });
  }

  async setDailyQuota(vendorId: string, menuId: string, dto: SetDailyQuotaDto) {
    // 阻擋設定過去日期
    const today = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Taipei' }).split(' ')[0];
    if (dto.targetDate < today) {
      throw new BadRequestException('不能設定過去日期的限量配額');
    }

    const menu = await this.prisma.menu.findFirst({
      where: { id: menuId, vendorId },
    });

    if (!menu) {
      throw new NotFoundException(`找不到這筆菜單或你沒有權限修改限量`);
    }

    const targetDate = new Date(dto.targetDate);

    // 使用 upsert，如果當天已經設過上限就更新，沒有就新增
    return this.prisma.dailyQuota.upsert({
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
  }
  /**
   * 公開全量菜單查詢（供 Recommendation Service 使用）。
   * 支援依 vendorId 和 isActive 過濾。
   * 回傳資料包含 vendor 基本資料，讓 Recommendation Service 不需要再打一次 vendors API。
   */
  async findAllPublic(vendorId?: string, isActive: boolean = true) {
    return this.prisma.menu.findMany({
      where: {
        isActive,
        ...(vendorId ? { vendorId } : {}),
      },
      select: {
        id: true,
        name: true,
        price: true,
        imageUrl: true,
        dailyLimit: true,
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
    const menu = await this.prisma.menu.findFirst({
      where: { id: menuId, vendorId },
      include: {
        // 回傳今天（含）以後的配額設定，讓商家管理頁可以一眼看到未來排程
        dailyQuotas: {
          where: { targetDate: { gte: new Date(new Date().toISOString().split('T')[0]) } },
          orderBy: { targetDate: 'asc' },
        },
      },
    });

    if (!menu) {
      throw new NotFoundException(`找不到這筆菜單或你沒有權限存取`);
    }
    return menu;
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
