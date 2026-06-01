import { ExecutionContext, ForbiddenException, BadRequestException } from '@nestjs/common';
import { ActiveVendorGuard } from './active-vendor.guard';
import { VendorsService } from '../../vendors/vendors.service';

describe('ActiveVendorGuard', () => {
  let guard: ActiveVendorGuard;
  const mockVendorsService = { findByUserId: jest.fn() } as unknown as VendorsService;

  const makeContext = (headers: Record<string, string>): ExecutionContext =>
    ({
      switchToHttp: () => ({ getRequest: () => ({ headers }) }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    guard = new ActiveVendorGuard(mockVendorsService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should allow an ACTIVE vendor', async () => {
    (mockVendorsService.findByUserId as jest.Mock).mockResolvedValue({ id: 'v1', status: 'ACTIVE' });
    await expect(guard.canActivate(makeContext({ 'x-user-id': '42' }))).resolves.toBe(true);
    expect(mockVendorsService.findByUserId).toHaveBeenCalledWith(42);
  });

  it('should block a SUSPENDED vendor with 403', async () => {
    (mockVendorsService.findByUserId as jest.Mock).mockResolvedValue({ id: 'v1', status: 'SUSPENDED' });
    await expect(guard.canActivate(makeContext({ 'x-user-id': '42' }))).rejects.toThrow(ForbiddenException);
  });

  it('should reject missing x-user-id (400 via parseXUserId)', async () => {
    await expect(guard.canActivate(makeContext({}))).rejects.toThrow(BadRequestException);
  });
});
