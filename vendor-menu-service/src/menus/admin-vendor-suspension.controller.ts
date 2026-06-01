import {
  Controller,
  Post,
  Param,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { MenusService } from './menus.service';
import { SuspendVendorDto } from '../vendors/dto/suspend-vendor.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { parseXUserId } from '../common/parse-x-user-id';

/**
 * 管理員（福委會）停權 / 復權商家端點。
 * - 放在 MenusModule，才能注入 MenusService 重用庫存視窗編排。
 * - 與 AdminVendorsController 共用 base path /api/v1/admin/vendors，路由不衝突。
 * - 需 API Gateway 注入 x-user-role: admin（RolesGuard 驗證）。
 */
@Controller('api/v1/admin/vendors')
@Roles('admin')
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class AdminVendorSuspensionController {
  constructor(private readonly menusService: MenusService) {}

  /**
   * POST /api/v1/admin/vendors/:id/suspend
   * 停權商家：記錄停權者/時間/原因，並把其 active 菜單庫存歸零。
   */
  @Post(':id/suspend')
  @HttpCode(HttpStatus.OK)
  async suspend(
    @Param('id') id: string,
    @Headers('x-user-id') xUserId: string,
    @Body() dto: SuspendVendorDto,
  ) {
    return this.menusService.suspendVendor(id, parseXUserId(xUserId), dto.reason);
  }

  /**
   * POST /api/v1/admin/vendors/:id/reactivate
   * 復權商家：還原狀態並重推 active 菜單庫存。
   */
  @Post(':id/reactivate')
  @HttpCode(HttpStatus.OK)
  async reactivate(@Param('id') id: string) {
    return this.menusService.reactivateVendor(id);
  }
}
