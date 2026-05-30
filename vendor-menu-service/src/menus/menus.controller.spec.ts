import { Test, TestingModule } from '@nestjs/testing';
import { MenusController } from './menus.controller';
import { MenusService } from './menus.service';
import { VendorsService } from '../vendors/vendors.service';
import { S3Service } from '../s3/s3.service';
import { CreateMenuDto } from './dto/create-menu.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';
import { SetDailyQuotaDto } from './dto/set-daily-quota.dto';
import { GetUploadUrlDto } from './dto/get-upload-url.dto';

// 所有 /me/menus handler 都先把 x-user-id（數字 userId）解析成 vendor.id（UUID）。
// 測試以數字 '42' 當 x-user-id，findByUserId 回傳 { id: VENDOR_ID }，再斷言下游收到 VENDOR_ID。
const VENDOR_ID = 'vendor-uuid';

describe('MenusController', () => {
  let controller: MenusController;
  let menusService: MenusService;
  let s3Service: S3Service;

  const mockMenusService = {
    create: jest.fn(),
    findAllByVendor: jest.fn(),
    findOneByVendor: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    setDailyQuota: jest.fn(),
  };

  const mockVendorsService = {
    findByUserId: jest.fn(),
  };

  const mockS3Service = {
    generateMenuImageUploadUrl: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MenusController],
      providers: [
        { provide: MenusService, useValue: mockMenusService },
        { provide: VendorsService, useValue: mockVendorsService },
        { provide: S3Service, useValue: mockS3Service },
      ],
    }).compile();

    controller = module.get<MenusController>(MenusController);
    menusService = module.get<MenusService>(MenusService);
    s3Service = module.get<S3Service>(S3Service);
    mockVendorsService.findByUserId.mockResolvedValue({ id: VENDOR_ID });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getUploadImageUrl', () => {
    it('should resolve x-user-id and call s3Service with vendor.id', async () => {
      const query: GetUploadUrlDto = { contentType: 'image/jpeg' };
      await controller.getUploadImageUrl('42', query);
      expect(mockVendorsService.findByUserId).toHaveBeenCalledWith(42);
      expect(s3Service.generateMenuImageUploadUrl).toHaveBeenCalledWith(VENDOR_ID, 'image/jpeg');
    });
  });

  describe('create', () => {
    it('should call menusService.create with resolved vendor.id', async () => {
      const dto: CreateMenuDto = { name: 'Menu', price: 100 };
      await controller.create('42', dto);
      expect(menusService.create).toHaveBeenCalledWith(VENDOR_ID, dto);
    });
  });

  describe('findAll', () => {
    it('should call menusService.findAllByVendor with resolved vendor.id', async () => {
      await controller.findAll('42');
      expect(menusService.findAllByVendor).toHaveBeenCalledWith(VENDOR_ID);
    });
  });

  describe('findOne', () => {
    it('should call menusService.findOneByVendor with resolved vendor.id', async () => {
      await controller.findOne('42', 'menu-1');
      expect(menusService.findOneByVendor).toHaveBeenCalledWith(VENDOR_ID, 'menu-1');
    });
  });

  describe('update', () => {
    it('should call menusService.update with resolved vendor.id', async () => {
      const dto: UpdateMenuDto = { price: 200 };
      await controller.update('42', 'menu-1', dto);
      expect(menusService.update).toHaveBeenCalledWith(VENDOR_ID, 'menu-1', dto);
    });
  });

  describe('remove', () => {
    it('should call menusService.remove with resolved vendor.id', async () => {
      await controller.remove('42', 'menu-1');
      expect(menusService.remove).toHaveBeenCalledWith(VENDOR_ID, 'menu-1');
    });
  });

  describe('setDailyQuota', () => {
    it('should call menusService.setDailyQuota with resolved vendor.id', async () => {
      const dto: SetDailyQuotaDto = { targetDate: '2099-01-01', maxQuantity: 50 };
      await controller.setDailyQuota('42', 'menu-1', dto);
      expect(menusService.setDailyQuota).toHaveBeenCalledWith(VENDOR_ID, 'menu-1', dto);
    });
  });
});
