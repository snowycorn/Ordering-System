import {
  Controller,
  Get,
  Put,
  Body,
  Headers,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { VendorsService } from '../vendors.service';
import { UpdateVendorDto } from '../dto/update-vendor.dto';
import { parseXUserId } from '../../common/parse-x-user-id';
import { ActiveVendorGuard } from '../../common/guards/active-vendor.guard';

/**
 * 商家自身管理端點（商家端後台）
 * - 需 API Gateway 驗證 JWT 並注入 x-user-id header（IAM 數字 userId）
 * - 商家只能操作「自己」的資料（透過 x-user-id → Vendor.userId 綁定）
 */
@Controller('api/v1/vendors/me')
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class MeVendorsController {
  constructor(private readonly vendorsService: VendorsService) {}

  /**
   * GET /api/v1/vendors/me
   * 商家查詢自己的完整資料。
   */
  @Get()
  async getMyProfile(@Headers('x-user-id') xUserId: string) {
    return this.vendorsService.findByUserId(parseXUserId(xUserId));
  }

  /**
   * PUT /api/v1/vendors/me
   * 商家更新自己的資料（名稱、描述、圖片等）。
   */
  @Put()
  @UseGuards(ActiveVendorGuard)
  async updateMyProfile(
    @Headers('x-user-id') xUserId: string,
    @Body() updateVendorDto: UpdateVendorDto,
  ) {
    const vendor = await this.vendorsService.findByUserId(parseXUserId(xUserId));
    return this.vendorsService.update(vendor.id, updateVendorDto);
  }
}
