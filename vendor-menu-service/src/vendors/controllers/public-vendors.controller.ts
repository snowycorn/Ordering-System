import {
  Controller,
  Get,
  Query,
  UsePipes,
  ValidationPipe,
  Param,
} from '@nestjs/common';
import { VendorsService } from '../vendors.service';
import { ListVendorsQueryDto } from '../dto/list-vendors-query.dto';
import { GetVendorMenusQueryDto } from '../dto/get-vendor-menus-query.dto';

/**
 * 公開查詢端點（員工端）
 * - 不需要任何 Header，無須身份驗證
 * - 只回傳 status = ACTIVE 的商家與菜單
 * - 可透過 Kong Gateway 直接對外開放
 */
@Controller('api/v1/vendors')
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class PublicVendorsController {
  constructor(private readonly vendorsService: VendorsService) {}

  /**
   * GET /api/v1/vendors?factoryZone=A廠
   * 查詢所有上架中的商家，可依廠區過濾。
   */
  @Get()
  async findAll(@Query() query: ListVendorsQueryDto) {
    return this.vendorsService.findAll(query.factoryZone);
  }

  /**
   * GET /api/v1/vendors/:id/menus?date=2024-01-15
   * 查詢指定商家的今日（或指定日期）菜單，附上當日配額上限。
   */
  @Get(':id/menus')
  async findVendorMenus(
    @Param('id') id: string,
    @Query() query: GetVendorMenusQueryDto,
  ) {
    return this.vendorsService.findVendorMenus(id, query.date);
  }
}
