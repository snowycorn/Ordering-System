import { Test, TestingModule } from '@nestjs/testing';
import { PublicVendorsController } from './public-vendors.controller';
import { VendorsService } from '../vendors.service';

describe('PublicVendorsController', () => {
  let controller: PublicVendorsController;
  let service: VendorsService;

  const mockVendorsService = {
    findAll: jest.fn(),
    findVendorMenus: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PublicVendorsController],
      providers: [{ provide: VendorsService, useValue: mockVendorsService }],
    }).compile();

    controller = module.get<PublicVendorsController>(PublicVendorsController);
    service = module.get<VendorsService>(VendorsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('findAll', () => {
    it('should call vendorsService.findAll with factoryZone', async () => {
      mockVendorsService.findAll.mockResolvedValue([]);
      await controller.findAll({ factoryZone: 'Zone A' });
      expect(service.findAll).toHaveBeenCalledWith('Zone A');
    });

    it('should call vendorsService.findAll without factoryZone', async () => {
      mockVendorsService.findAll.mockResolvedValue([]);
      await controller.findAll({});
      expect(service.findAll).toHaveBeenCalledWith(undefined);
    });
  });

  describe('findVendorMenus', () => {
    it('should call vendorsService.findVendorMenus with id and date', async () => {
      mockVendorsService.findVendorMenus.mockResolvedValue([]);
      await controller.findVendorMenus('uuid-1', { date: '2026-05-29' });
      expect(service.findVendorMenus).toHaveBeenCalledWith('uuid-1', '2026-05-29');
    });
  });
});
