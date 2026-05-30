// src/common/guards/roles.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * 全域角色守衛（Role-Based Access Control）。
 *
 * 運作原理：
 * - API Gateway（Kong）驗證 JWT 後，將使用者角色（role）寫入 x-user-role Header
 * - 本守衛讀取該 Header，對照 @Roles() 裝飾器標記的允許角色
 * - 若 route 沒有 @Roles()，守衛直接放行（外部商家入駐用的公開端點不需要登入）
 *
 * 角色值範例：'admin'（福委會）| 'vendor' | 'employee'
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // 取得這個 handler（或 class）上 @Roles() 標記的角色列表
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // 沒有 @Roles() 裝飾器 → 公開端點，直接放行
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const userRole: string | undefined = request.headers?.['x-user-role'];

    if (!userRole) {
      throw new ForbiddenException('缺少 x-user-role Header，請透過 API Gateway 存取');
    }

    if (!requiredRoles.includes(userRole)) {
      throw new ForbiddenException(
        `此操作需要以下角色之一：${requiredRoles.join(', ')}，目前角色：${userRole}`,
      );
    }

    return true;
  }
}
