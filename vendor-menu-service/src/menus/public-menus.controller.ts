// src/menus/public-menus.controller.ts
import { Controller, Get, Param, Query, UsePipes, ValidationPipe } from '@nestjs/common';
import { MenusService } from './menus.service';
import { ListPublicMenusQueryDto } from './dto/list-public-menus-query.dto';

/**
 * 公開菜單查詢端點（Service-to-Service 內部 API）
 *
 * 主要供 Recommendation Service 使用：
 * - 拉取全量有效菜單 → 計算推薦候選集
 * - 支援 vendorId 過濾、isActive 過濾
 *
 * 此 Controller 不需要 x-user-id header。
 * 在 K8s 環境中，此端點應只允許 cluster 內部的服務存取（透過 NetworkPolicy）。
 */
@Controller('api/v1/menus')
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class PublicMenusController {
  constructor(private readonly menusService: MenusService) {}

  /**
   * GET /api/v1/menus
   * GET /api/v1/menus?vendorId=xxx
   * GET /api/v1/menus?isActive=false
   */
  @Get()
  async findAll(@Query() query: ListPublicMenusQueryDto) {
    return this.menusService.findAllPublic(query.vendorId, query.isActive ?? true);
  }

  /**
   * GET /api/v1/menus/:menuId
   * 查詢單一菜單詳情，附帶商家基本資訊。
   * 下架（isActive = false）的品項回傳 404。
   */
  @Get(':menuId')
  async findOne(@Param('menuId') menuId: string) {
    return this.menusService.findOnePublic(menuId);
  }
}
