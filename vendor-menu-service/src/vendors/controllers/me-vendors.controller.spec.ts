import { Test, TestingModule } from '@nestjs/testing';
import { MeVendorsController } from './me-vendors.controller';
import { VendorsService } from '../vendors.service';
import { UpdateVendorDto } from '../dto/update-vendor.dto';

describe('MeVendorsController', () => {
  let controller: MeVendorsController;
  let service: VendorsService;

  const mockVendorsService = {
    findOne: jest.fn(),
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
    it('should call vendorsService.findOne with x-user-id', async () => {
      mockVendorsService.findOne.mockResolvedValue({});
      await controller.getMyProfile('uuid-1');
      expect(service.findOne).toHaveBeenCalledWith('uuid-1');
    });
  });

  describe('updateMyProfile', () => {
    it('should call vendorsService.update with x-user-id and dto', async () => {
      mockVendorsService.update.mockResolvedValue({});
      const dto: UpdateVendorDto = { name: 'New Name' };
      await controller.updateMyProfile('uuid-1', dto);
      expect(service.update).toHaveBeenCalledWith('uuid-1', dto);
    });
  });
});
