import {
  Controller,
  Get,
  Put,
  Body,
  Headers,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { VendorsService } from '../vendors.service';
import { S3Service } from '../../s3/s3.service';
import { UpdateVendorDto } from '../dto/update-vendor.dto';
import { GetUploadUrlDto } from '../../menus/dto/get-upload-url.dto';
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
  constructor(
    private readonly vendorsService: VendorsService,
    private readonly s3Service: S3Service,
  ) {}

  /**
   * GET /api/v1/vendors/me
   * 商家查詢自己的完整資料。
   */
  @Get()
  async getMyProfile(@Headers('x-user-id') xUserId: string) {
    return this.vendorsService.findByUserId(parseXUserId(xUserId));
  }

  /**
   * GET /api/v1/vendors/me/upload-image-url?contentType=image/jpeg
   *
   * 商家圖片上傳流程（比照菜單圖片）：
   * 1. 前端帶 contentType 呼叫此端點
   * 2. 後端回傳有效期 5 分鐘的 pre-signed PUT URL（uploadUrl）與最終 imageUrl
   * 3. 前端直接 PUT 圖片到 uploadUrl（圖片不經過後端）
   * 4. 前端用 PUT /api/v1/vendors/me 帶 imageUrl 存入商家資料
   */
  @Get('upload-image-url')
  @UseGuards(ActiveVendorGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async getUploadImageUrl(
    @Headers('x-user-id') xUserId: string,
    @Query() query: GetUploadUrlDto,
  ) {
    const vendor = await this.vendorsService.findByUserId(
      parseXUserId(xUserId),
    );
    return this.s3Service.generateVendorImageUploadUrl(
      vendor.id,
      query.contentType,
    );
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
