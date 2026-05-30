import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Param,
  Delete,
  Headers,
  UsePipes,
  ValidationPipe,
  Query,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { MenusService } from './menus.service';
import { S3Service } from '../s3/s3.service';
import { CreateMenuDto } from './dto/create-menu.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';
import { SetDailyQuotaDto } from './dto/set-daily-quota.dto';
import { GetUploadUrlDto } from './dto/get-upload-url.dto';

// 路徑設計為 /api/v1/vendors/me/menus，確保商家只能操作自己的菜單
@Controller('api/v1/vendors/me/menus')
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class MenusController {
  constructor(
    private readonly menusService: MenusService,
    private readonly s3Service: S3Service,
  ) {}

  /**
   * GET /api/v1/vendors/me/menus/upload-image-url?contentType=image/jpeg
   *
   * 圖片上傳的完整流程：
   * 1. 前端帶著 contentType 呼叫這個端點
   * 2. 後端向 AWS 申請一個有效期 5 分鐘的 pre-signed PUT URL
   * 3. 後端回傳 { uploadUrl, imageUrl }
   * 4. 前端直接對 uploadUrl 發 HTTP PUT 請求，把圖片傳到 S3（圖片不經過後端）
   * 5. 前端用 imageUrl 建立或更新菜單（PUT /menus/:id 帶 imageUrl）
   *
   * @Throttle：限制同一 IP 每分鐘最多 10 次請求，防止濫用 pre-signed URL 額度
   */
  @Get('upload-image-url')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async getUploadImageUrl(
    @Headers('x-user-id') vendorId: string,
    @Query() query: GetUploadUrlDto,
  ) {
    return this.s3Service.generateMenuImageUploadUrl(vendorId, query.contentType);
  }

  @Post()
  async create(
    @Headers('x-user-id') vendorId: string,
    @Body() createMenuDto: CreateMenuDto,
  ) {
    return this.menusService.create(vendorId, createMenuDto);
  }

  @Get()
  async findAll(@Headers('x-user-id') vendorId: string) {
    return this.menusService.findAllByVendor(vendorId);
  }

  @Get(':menuId')
  async findOne(
    @Headers('x-user-id') vendorId: string,
    @Param('menuId') menuId: string,
  ) {
    return this.menusService.findOneByVendor(vendorId, menuId);
  }

  @Put(':menuId')
  async update(
    @Headers('x-user-id') vendorId: string,
    @Param('menuId') menuId: string,
    @Body() updateMenuDto: UpdateMenuDto,
  ) {
    return this.menusService.update(vendorId, menuId, updateMenuDto);
  }

  @Delete(':menuId')
  async remove(
    @Headers('x-user-id') vendorId: string,
    @Param('menuId') menuId: string,
  ) {
    return this.menusService.remove(vendorId, menuId);
  }

  @Put(':menuId/quotas')
  async setDailyQuota(
    @Headers('x-user-id') vendorId: string,
    @Param('menuId') menuId: string,
    @Body() setDailyQuotaDto: SetDailyQuotaDto,
  ) {
    return this.menusService.setDailyQuota(vendorId, menuId, setDailyQuotaDto);
  }
}
