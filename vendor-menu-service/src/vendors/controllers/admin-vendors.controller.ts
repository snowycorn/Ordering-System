import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { VendorsService } from '../vendors.service';
import { CreateVendorDto } from '../dto/create-vendor.dto';
import { UpdateVendorDto } from '../dto/update-vendor.dto';
import { Roles } from '../../common/decorators/roles.decorator';

/**
 * 管理員（福委會）端點
 * - 整個 Controller 掛上 @Roles('admin')，確保新增 API 時預設受到保護
 * - 需 API Gateway 驗證 JWT 並注入 x-user-role: admin header
 * - 建議透過 Kong Gateway 設定 IP 白名單，僅限公司內網存取
 */
@Controller('api/v1/admin/vendors')
@Roles('admin')
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class AdminVendorsController {
  constructor(private readonly vendorsService: VendorsService) {}

  /**
   * POST /api/v1/admin/vendors
   * 建立新商家帳號。新商家預設狀態為 ACTIVE。
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createVendorDto: CreateVendorDto) {
    return this.vendorsService.create(createVendorDto);
  }

  /**
   * GET /api/v1/admin/vendors/:id
   * 查詢任意商家的完整資料（含敏感管理欄位）。
   */
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.vendorsService.findOne(id);
  }

  /**
   * PUT /api/v1/admin/vendors/:id
   * 更新任意商家的資料（例如強制停權、修改授權廠區）。
   */
  @Put(':id')
  async update(@Param('id') id: string, @Body() updateVendorDto: UpdateVendorDto) {
    return this.vendorsService.update(id, updateVendorDto);
  }
}
