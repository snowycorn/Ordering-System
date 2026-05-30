import { Test, TestingModule } from '@nestjs/testing';
import { MeVendorsController } from './me-vendors.controller';
import { VendorsService } from '../vendors.service';
import { UpdateVendorDto } from '../dto/update-vendor.dto';

describe('MeVendorsController', () => {
  let controller: MeVendorsController;
  let service: VendorsService;

  const mockVendorsService = {
    findOne: jest.fn(),
    findByUserId: jest.fn(),
    update: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MeVendorsController],
      providers: [{ provide: VendorsService, useValue: mockVendorsService }],
    }).compile();

    controller = module.get<MeVendorsController>(MeVendorsController);
    service = module.get<VendorsService>(VendorsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('getMyProfile', () => {
    it('should resolve x-user-id to vendor via findByUserId', async () => {
      mockVendorsService.findByUserId.mockResolvedValue({ id: 'vendor-uuid' });
      await controller.getMyProfile('42');
      expect(service.findByUserId).toHaveBeenCalledWith(42);
    });
  });

  describe('updateMyProfile', () => {
    it('should resolve x-user-id then update by vendor.id', async () => {
      mockVendorsService.findByUserId.mockResolvedValue({ id: 'vendor-uuid' });
      mockVendorsService.update.mockResolvedValue({});
      const dto: UpdateVendorDto = { name: 'New Name' };
      await controller.updateMyProfile('42', dto);
      expect(service.findByUserId).toHaveBeenCalledWith(42);
      expect(service.update).toHaveBeenCalledWith('vendor-uuid', dto);
    });
  });
});
