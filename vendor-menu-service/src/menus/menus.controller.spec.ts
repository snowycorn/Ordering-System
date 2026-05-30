import { Test, TestingModule } from '@nestjs/testing';
import { MenusController } from './menus.controller';
import { MenusService } from './menus.service';
import { S3Service } from '../s3/s3.service';
import { CreateMenuDto } from './dto/create-menu.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';
import { SetDailyQuotaDto } from './dto/set-daily-quota.dto';
import { GetUploadUrlDto } from './dto/get-upload-url.dto';

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

  const mockS3Service = {
    generateMenuImageUploadUrl: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MenusController],
      providers: [
        { provide: MenusService, useValue: mockMenusService },
        { provide: S3Service, useValue: mockS3Service },
      ],
    }).compile();

    controller = module.get<MenusController>(MenusController);
    menusService = module.get<MenusService>(MenusService);
    s3Service = module.get<S3Service>(S3Service);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getUploadImageUrl', () => {
    it('should call s3Service.generateMenuImageUploadUrl', async () => {
      const query: GetUploadUrlDto = { contentType: 'image/jpeg' };
      await controller.getUploadImageUrl('vendor-1', query);
      expect(s3Service.generateMenuImageUploadUrl).toHaveBeenCalledWith('vendor-1', 'image/jpeg');
    });
  });

  describe('create', () => {
    it('should call menusService.create', async () => {
      const dto: CreateMenuDto = { name: 'Menu', price: 100 };
      await controller.create('vendor-1', dto);
      expect(menusService.create).toHaveBeenCalledWith('vendor-1', dto);
    });
  });

  describe('findAll', () => {
    it('should call menusService.findAllByVendor', async () => {
      await controller.findAll('vendor-1');
      expect(menusService.findAllByVendor).toHaveBeenCalledWith('vendor-1');
    });
  });

  describe('findOne', () => {
    it('should call menusService.findOneByVendor', async () => {
      await controller.findOne('vendor-1', 'menu-1');
      expect(menusService.findOneByVendor).toHaveBeenCalledWith('vendor-1', 'menu-1');
    });
  });

  describe('update', () => {
    it('should call menusService.update', async () => {
      const dto: UpdateMenuDto = { price: 200 };
      await controller.update('vendor-1', 'menu-1', dto);
      expect(menusService.update).toHaveBeenCalledWith('vendor-1', 'menu-1', dto);
    });
  });

  describe('remove', () => {
    it('should call menusService.remove', async () => {
      await controller.remove('vendor-1', 'menu-1');
      expect(menusService.remove).toHaveBeenCalledWith('vendor-1', 'menu-1');
    });
  });

  describe('setDailyQuota', () => {
    it('should call menusService.setDailyQuota', async () => {
      const dto: SetDailyQuotaDto = { targetDate: '2099-01-01', maxQuantity: 50 };
      await controller.setDailyQuota('vendor-1', 'menu-1', dto);
      expect(menusService.setDailyQuota).toHaveBeenCalledWith('vendor-1', 'menu-1', dto);
    });
  });
});
