import { Test, TestingModule } from '@nestjs/testing';
import { InventorySyncService } from './inventory-sync.service';
import { PrismaService } from '../prisma/prisma.service';
import { OrderInventoryClient } from '../integrations/order-inventory.client';

describe('InventorySyncService', () => {
  let service: InventorySyncService;

  const mockPrismaService = {
    menu: { findMany: jest.fn() },
    dailyQuota: { findFirst: jest.fn() },
  };
  const mockOrderInventory = { setInventory: jest.fn().mockResolvedValue(true) };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventorySyncService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: OrderInventoryClient, useValue: mockOrderInventory },
      ],
    }).compile();

    service = module.get<InventorySyncService>(InventorySyncService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should only push for active menus of active (non-suspended) vendors', async () => {
    mockPrismaService.menu.findMany.mockResolvedValue([]);

    await service.pushRollingBoundary();

    expect(mockPrismaService.menu.findMany).toHaveBeenCalledWith({
      where: { isActive: true, vendor: { is: { status: 'ACTIVE' } } },
    });
  });

  it('should push boundary-day inventory for each menu', async () => {
    mockPrismaService.menu.findMany.mockResolvedValue([{ id: 'm1', dailyLimit: 10 }]);
    mockPrismaService.dailyQuota.findFirst.mockResolvedValue(null);

    await service.pushRollingBoundary();

    expect(mockOrderInventory.setInventory).toHaveBeenCalledWith('m1', expect.any(String), 10);
  });
});
