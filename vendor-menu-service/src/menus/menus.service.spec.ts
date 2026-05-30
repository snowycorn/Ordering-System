import { Test, TestingModule } from '@nestjs/testing';
import { MenusService } from './menus.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { CreateMenuDto } from './dto/create-menu.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';
import { SetDailyQuotaDto } from './dto/set-daily-quota.dto';

describe('MenusService', () => {
  let service: MenusService;
  let prisma: PrismaService;

  const mockPrismaService = {
    menu: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    dailyQuota: {
      upsert: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MenusService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<MenusService>(MenusService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create menu correctly', async () => {
      const dto: CreateMenuDto = { name: 'Item', price: 100 };
      mockPrismaService.menu.create.mockResolvedValue({ id: 'menu-1', vendorId: 'vendor-1', ...dto });

      const result = await service.create('vendor-1', dto);
      expect(prisma.menu.create).toHaveBeenCalledWith({
        data: { vendorId: 'vendor-1', ...dto },
      });
      expect(result.id).toBe('menu-1');
    });
  });

  describe('findAllByVendor', () => {
    it('should return all menus for a vendor', async () => {
      mockPrismaService.menu.findMany.mockResolvedValue([]);
      await service.findAllByVendor('vendor-1');
      expect(prisma.menu.findMany).toHaveBeenCalledWith({ where: { vendorId: 'vendor-1' } });
    });
  });

  describe('update', () => {
    it('should update menu if it exists and belongs to vendor', async () => {
      mockPrismaService.menu.findFirst.mockResolvedValue({ id: 'menu-1', vendorId: 'vendor-1' });
      const dto: UpdateMenuDto = { price: 150 };
      mockPrismaService.menu.update.mockResolvedValue({ id: 'menu-1', price: 150 });

      const result = await service.update('vendor-1', 'menu-1', dto);
      expect(prisma.menu.findFirst).toHaveBeenCalledWith({ where: { id: 'menu-1', vendorId: 'vendor-1' } });
      expect(prisma.menu.update).toHaveBeenCalledWith({
        where: { id: 'menu-1' },
        data: dto,
      });
      expect(result.price).toBe(150);
    });

    it('should throw NotFoundException if menu not found or not owned', async () => {
      mockPrismaService.menu.findFirst.mockResolvedValue(null);
      await expect(service.update('vendor-1', 'menu-1', {})).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should soft delete menu', async () => {
      mockPrismaService.menu.findFirst.mockResolvedValue({ id: 'menu-1' });
      mockPrismaService.menu.update.mockResolvedValue({ id: 'menu-1', isActive: false });

      await service.remove('vendor-1', 'menu-1');
      expect(prisma.menu.update).toHaveBeenCalledWith({
        where: { id: 'menu-1' },
        data: { isActive: false },
      });
    });

    it('should throw NotFoundException if menu not found', async () => {
      mockPrismaService.menu.findFirst.mockResolvedValue(null);
      await expect(service.remove('vendor-1', 'menu-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('setDailyQuota', () => {
    it('should throw BadRequestException if date is in the past', async () => {
      const pastDate = '2000-01-01'; // decidedly in the past
      const dto: SetDailyQuotaDto = { targetDate: pastDate, maxQuantity: 10 };
      await expect(service.setDailyQuota('vendor-1', 'menu-1', dto)).rejects.toThrow(BadRequestException);
    });

    it('should set quota if date is today or future', async () => {
      // Create a future date strictly to avoid timezone edge cases in tests
      const futureDateStr = '2099-12-31';
      const dto: SetDailyQuotaDto = { targetDate: futureDateStr, maxQuantity: 10 };

      mockPrismaService.menu.findFirst.mockResolvedValue({ id: 'menu-1' });
      mockPrismaService.dailyQuota.upsert.mockResolvedValue({ id: 'quota-1' });

      await service.setDailyQuota('vendor-1', 'menu-1', dto);
      
      expect(prisma.dailyQuota.upsert).toHaveBeenCalledWith(expect.objectContaining({
        create: {
          menuId: 'menu-1',
          targetDate: new Date(futureDateStr),
          maxQuantity: 10,
        }
      }));
    });
  });

  describe('findAllPublic', () => {
    it('should filter by isActive and vendorId', async () => {
      mockPrismaService.menu.findMany.mockResolvedValue([]);
      await service.findAllPublic('vendor-1', true);
      expect(prisma.menu.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { isActive: true, vendorId: 'vendor-1' }
      }));
    });
  });

  describe('findOneByVendor', () => {
    it('should return menu with quotas', async () => {
      mockPrismaService.menu.findFirst.mockResolvedValue({ id: 'menu-1' });
      await service.findOneByVendor('vendor-1', 'menu-1');
      expect(prisma.menu.findFirst).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'menu-1', vendorId: 'vendor-1' }
      }));
    });
  });

  describe('findOnePublic', () => {
    it('should return active menu', async () => {
      mockPrismaService.menu.findFirst.mockResolvedValue({ id: 'menu-1' });
      await service.findOnePublic('menu-1');
      expect(prisma.menu.findFirst).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'menu-1', isActive: true }
      }));
    });

    it('should throw NotFoundException if not found or inactive', async () => {
      mockPrismaService.menu.findFirst.mockResolvedValue(null);
      await expect(service.findOnePublic('menu-1')).rejects.toThrow(NotFoundException);
    });
  });
});
