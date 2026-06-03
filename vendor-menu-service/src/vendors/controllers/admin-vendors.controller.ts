import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { VendorsService } from '../vendors.service';
import { CreateVendorDto } from '../dto/create-vendor.dto';
import { AdminUpdateVendorDto } from '../dto/admin-update-vendor.dto';
import { AdminListVendorsQueryDto } from '../dto/admin-list-vendors-query.dto';
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
   * GET /api/v1/admin/vendors
   * 列出所有商家（含 SUSPENDED、含管理欄位）。可選 ?status、?factoryZone 過濾。
   */
  @Get()
  async findAll(@Query() query: AdminListVendorsQueryDto) {
    return this.vendorsService.findAllForAdmin(query.status, query.factoryZone);
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
   * 更新任意商家的 profile 資料（名稱、分類、描述、服務廠區 factoryZones）。
   * 廠區僅 admin 可改（商家自管的 PUT /vendors/me 不含此欄位）。
   * 停權/復權請改用 POST /:id/suspend、POST /:id/reactivate（status 不可由此端點變更）。
   */
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateVendorDto: AdminUpdateVendorDto,
  ) {
    return this.vendorsService.update(id, updateVendorDto);
  }

  /**
   * POST /api/v1/admin/vendors/:id/violation-points
   * 為指定商家的違規點數 +1（每次呼叫累加 1）。
   */
  @Post(':id/violation-points')
  @HttpCode(HttpStatus.OK)
  async addViolationPoint(@Param('id') id: string) {
    return this.vendorsService.addViolationPoint(id);
  }
}
