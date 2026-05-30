import { Test, TestingModule } from '@nestjs/testing';
import { VendorsService } from './vendors.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';

describe('VendorsService', () => {
  let service: VendorsService;
  let prisma: PrismaService;

  const mockPrismaService = {
    vendor: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    menu: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VendorsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<VendorsService>(VendorsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new vendor with ACTIVE status', async () => {
      const dto: CreateVendorDto = { name: 'Test Vendor', category: 'Bento' };
      const expectedResult = { id: 'uuid-1', ...dto, status: 'ACTIVE' };
      mockPrismaService.vendor.create.mockResolvedValue(expectedResult);

      const result = await service.create(dto);

      expect(prisma.vendor.create).toHaveBeenCalledWith({
        data: {
          ...dto,
          status: 'ACTIVE',
        },
      });
      expect(result).toEqual(expectedResult);
    });

    it('should throw ConflictException when userId already bound (Prisma P2002)', async () => {
      const dto: CreateVendorDto = { name: 'Dup Vendor', userId: 99 };
      const p2002 = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
      });
      mockPrismaService.vendor.create.mockRejectedValue(p2002);

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
    });

    it('should rethrow non-P2002 prisma errors as-is', async () => {
      const dto: CreateVendorDto = { name: 'Vendor', userId: 1 };
      const other = new Prisma.PrismaClientKnownRequestError('boom', {
        code: 'P2003',
        clientVersion: 'test',
      });
      mockPrismaService.vendor.create.mockRejectedValue(other);

      await expect(service.create(dto)).rejects.toBe(other);
    });
  });

  describe('findOne', () => {
    it('should return a vendor if it exists', async () => {
      const vendor = { id: 'uuid-1', name: 'Vendor 1' };
      mockPrismaService.vendor.findUnique.mockResolvedValue(vendor);

      const result = await service.findOne('uuid-1');

      expect(prisma.vendor.findUnique).toHaveBeenCalledWith({ where: { id: 'uuid-1' } });
      expect(result).toEqual(vendor);
    });

    it('should throw NotFoundException if vendor does not exist', async () => {
      mockPrismaService.vendor.findUnique.mockResolvedValue(null);

      await expect(service.findOne('uuid-999')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByUserId', () => {
    it('should return a vendor matched by userId', async () => {
      const vendor = { id: 'uuid-1', userId: 42, name: 'Vendor 1' };
      mockPrismaService.vendor.findUnique.mockResolvedValue(vendor);

      const result = await service.findByUserId(42);

      expect(prisma.vendor.findUnique).toHaveBeenCalledWith({ where: { userId: 42 } });
      expect(result).toEqual(vendor);
    });

    it('should throw NotFoundException if no vendor has that userId', async () => {
      mockPrismaService.vendor.findUnique.mockResolvedValue(null);

      await expect(service.findByUserId(99999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update and return the vendor if it exists', async () => {
      const vendor = { id: 'uuid-1', name: 'Vendor 1' };
      mockPrismaService.vendor.findUnique.mockResolvedValue(vendor);
      
      const updateDto: UpdateVendorDto = { name: 'Updated Vendor' };
      const updatedVendor = { ...vendor, ...updateDto };
      mockPrismaService.vendor.update.mockResolvedValue(updatedVendor);

      const result = await service.update('uuid-1', updateDto);

      expect(prisma.vendor.findUnique).toHaveBeenCalledWith({ where: { id: 'uuid-1' } });
      expect(prisma.vendor.update).toHaveBeenCalledWith({
        where: { id: 'uuid-1' },
        data: updateDto,
      });
      expect(result).toEqual(updatedVendor);
    });

    it('should throw NotFoundException if vendor to update does not exist', async () => {
      mockPrismaService.vendor.findUnique.mockResolvedValue(null);
      
      await expect(service.update('uuid-999', {})).rejects.toThrow(NotFoundException);
      expect(prisma.vendor.update).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should find all active vendors', async () => {
      mockPrismaService.vendor.findMany.mockResolvedValue([]);
      
      await service.findAll();

      expect(prisma.vendor.findMany).toHaveBeenCalledWith({
        where: { status: 'ACTIVE' },
        select: expect.any(Object),
        orderBy: { name: 'asc' },
      });
    });

    it('should filter by factoryZone if provided', async () => {
      mockPrismaService.vendor.findMany.mockResolvedValue([]);
      
      await service.findAll('Zone A');

      expect(prisma.vendor.findMany).toHaveBeenCalledWith({
        where: { status: 'ACTIVE', factoryZone: 'Zone A' },
        select: expect.any(Object),
        orderBy: { name: 'asc' },
      });
    });
  });

  describe('findVendorMenus', () => {
    it('should map todayMaxQuantity correctly when dailyQuotas exist', async () => {
      // Mock vendor existence
      mockPrismaService.vendor.findUnique.mockResolvedValue({ id: 'uuid-1' });

      const mockDate = '2026-05-29';
      const menuWithQuota = {
        id: 'menu-1',
        name: 'Bento',
        price: 100,
        imageUrl: null,
        dailyLimit: 50,
        isActive: true,
        dailyQuotas: [
          { maxQuantity: 30 }
        ]
      };
      mockPrismaService.menu.findMany.mockResolvedValue([menuWithQuota]);

      const result = await service.findVendorMenus('uuid-1', mockDate);

      expect(prisma.vendor.findUnique).toHaveBeenCalledWith({ where: { id: 'uuid-1' } });
      expect(prisma.menu.findMany).toHaveBeenCalledWith({
        where: { vendorId: 'uuid-1', isActive: true },
        include: {
          dailyQuotas: {
            where: { targetDate: new Date(mockDate) },
            take: 1,
          },
        },
        orderBy: { name: 'asc' },
      });
      expect(result).toHaveLength(1);
      expect(result[0].todayMaxQuantity).toBe(30);
      expect(result[0].dailyLimit).toBe(50);
      expect(result[0].date).toBe(mockDate);
    });

    it('should map todayMaxQuantity to null when no dailyQuotas exist', async () => {
      mockPrismaService.vendor.findUnique.mockResolvedValue({ id: 'uuid-1' });

      const mockDate = '2026-05-29';
      const menuWithoutQuota = {
        id: 'menu-2',
        name: 'Ramen',
        price: 120,
        imageUrl: null,
        dailyLimit: 20,
        isActive: true,
        dailyQuotas: [] // empty
      };
      mockPrismaService.menu.findMany.mockResolvedValue([menuWithoutQuota]);

      const result = await service.findVendorMenus('uuid-1', mockDate);
      expect(result[0].todayMaxQuantity).toBeNull();
      expect(result[0].dailyLimit).toBe(20);
    });

    it('should use current date if dateString is not provided', async () => {
      mockPrismaService.vendor.findUnique.mockResolvedValue({ id: 'uuid-1' });
      mockPrismaService.menu.findMany.mockResolvedValue([]);

      await service.findVendorMenus('uuid-1');

      expect(prisma.menu.findMany).toHaveBeenCalled();
      const callArgs = mockPrismaService.menu.findMany.mock.calls[0][0];
      // verify it uses some valid date object for targetDate
      expect(callArgs.include.dailyQuotas.where.targetDate).toBeInstanceOf(Date);
    });
  });
});
