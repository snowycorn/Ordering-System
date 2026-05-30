// src/common/decorators/roles.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * 標記此端點需要特定角色才能存取。
 * 角色值由 API Gateway 驗證 JWT 後，以 x-user-role Header 注入。
 *
 * 使用範例：@Roles('admin')
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
