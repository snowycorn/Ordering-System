import { Test, TestingModule } from '@nestjs/testing';
import { AdminVendorsController } from './admin-vendors.controller';
import { VendorsService } from '../vendors.service';
import { CreateVendorDto } from '../dto/create-vendor.dto';
import { UpdateVendorDto } from '../dto/update-vendor.dto';

describe('AdminVendorsController', () => {
  let controller: AdminVendorsController;
  let service: VendorsService;

  const mockVendorsService = {
    create: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminVendorsController],
      providers: [{ provide: VendorsService, useValue: mockVendorsService }],
    }).compile();

    controller = module.get<AdminVendorsController>(AdminVendorsController);
    service = module.get<VendorsService>(VendorsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('should call vendorsService.create with dto', async () => {
      const dto: CreateVendorDto = { name: 'New Vendor' };
      mockVendorsService.create.mockResolvedValue({});
      await controller.create(dto);
      expect(service.create).toHaveBeenCalledWith(dto);
    });
  });

  describe('findOne', () => {
    it('should call vendorsService.findOne with id', async () => {
      mockVendorsService.findOne.mockResolvedValue({});
      await controller.findOne('uuid-1');
      expect(service.findOne).toHaveBeenCalledWith('uuid-1');
    });
  });

  describe('update', () => {
    it('should call vendorsService.update with id and dto', async () => {
      mockVendorsService.update.mockResolvedValue({});
      const dto: UpdateVendorDto = { name: 'Updated' };
      await controller.update('uuid-1', dto);
      expect(service.update).toHaveBeenCalledWith('uuid-1', dto);
    });
  });
});
