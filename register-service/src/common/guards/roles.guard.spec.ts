// src/common/guards/roles.guard.spec.ts
import { Reflector } from '@nestjs/core';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { RolesGuard } from './roles.guard';
import { ROLES_KEY } from '../decorators/roles.decorator';

function makeContext(userRole: string | undefined, requiredRoles: string[] | undefined) {
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(requiredRoles),
  } as unknown as Reflector;

  const request = {
    headers: userRole !== undefined ? { 'x-user-role': userRole } : {},
  };

  const context = {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;

  return { reflector, context };
}

describe('RolesGuard', () => {
  it('沒有 @Roles() 裝飾器時直接放行（公開端點）', () => {
    const { reflector, context } = makeContext(undefined, undefined);
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('@Roles([]) 空陣列也放行', () => {
    const { reflector, context } = makeContext(undefined, []);
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('@Roles("admin") + x-user-role: admin → 通過', () => {
    const { reflector, context } = makeContext('admin', ['admin']);
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('@Roles("admin") + 缺少 x-user-role header → ForbiddenException', () => {
    const { reflector, context } = makeContext(undefined, ['admin']);
    const guard = new RolesGuard(reflector);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('@Roles("admin") + x-user-role: vendor → ForbiddenException（角色不符）', () => {
    const { reflector, context } = makeContext('vendor', ['admin']);
    const guard = new RolesGuard(reflector);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('Reflector 被正確呼叫，傳入 ROLES_KEY', () => {
    const { reflector, context } = makeContext('admin', ['admin']);
    const guard = new RolesGuard(reflector);
    guard.canActivate(context);
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(
      ROLES_KEY,
      expect.any(Array),
    );
  });
});
