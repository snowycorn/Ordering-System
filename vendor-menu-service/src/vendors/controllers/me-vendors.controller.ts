import {
  Controller,
  Get,
  Put,
  Body,
  Headers,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { VendorsService } from '../vendors.service';
import { UpdateVendorDto } from '../dto/update-vendor.dto';

/**
 * 商家自身管理端點（商家端後台）
 * - 需 API Gateway 驗證 JWT 並注入 x-user-id header
 * - 商家只能操作「自己」的資料（透過 x-user-id 做 vendorId 綁定）
 */
@Controller('api/v1/vendors/me')
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class MeVendorsController {
  constructor(private readonly vendorsService: VendorsService) {}

  /**
   * GET /api/v1/vendors/me
   * 商家查詢自己的完整資料（含 allowedAreas 等後台欄位）。
   */
  @Get()
  async getMyProfile(@Headers('x-user-id') vendorId: string) {
    return this.vendorsService.findOne(vendorId);
  }

  /**
   * PUT /api/v1/vendors/me
   * 商家更新自己的資料（名稱、描述、圖片等）。
   */
  @Put()
  async updateMyProfile(
    @Headers('x-user-id') vendorId: string,
    @Body() updateVendorDto: UpdateVendorDto,
  ) {
    return this.vendorsService.update(vendorId, updateVendorDto);
  }
}
