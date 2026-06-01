// src/common/guards/active-vendor.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { VendorsService, VENDOR_STATUS } from '../../vendors/vendors.service';
import { parseXUserId } from '../parse-x-user-id';

/**
 * 阻擋已停權商家的寫入操作。
 *
 * 運作原理：
 * - 由 x-user-id（Gateway 注入）解析出商家，檢查 vendor.status
 * - 非 ACTIVE（已停權）→ 丟 403；ACTIVE → 放行
 * - 僅套在 self-service 的寫入端點；GET 不套，停權商家仍可查看自己的狀態
 */
@Injectable()
export class ActiveVendorGuard implements CanActivate {
  constructor(private readonly vendorsService: VendorsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const xUserId: string | undefined = request.headers?.['x-user-id'];

    const vendor = await this.vendorsService.findByUserId(parseXUserId(xUserId));
    if (vendor.status !== VENDOR_STATUS.ACTIVE) {
      throw new ForbiddenException('帳號已被停權，無法執行此操作');
    }

    return true;
  }
}
