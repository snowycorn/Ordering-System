import { Test, TestingModule } from '@nestjs/testing';
import { PublicMenusController } from './public-menus.controller';
import { MenusService } from './menus.service';
import { ListPublicMenusQueryDto } from './dto/list-public-menus-query.dto';

describe('PublicMenusController', () => {
  let controller: PublicMenusController;
  let service: MenusService;

  const mockMenusService = {
    findAllPublic: jest.fn(),
    findOnePublic: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PublicMenusController],
      providers: [
        {
          provide: MenusService,
          useValue: mockMenusService,
        },
      ],
    }).compile();

    controller = module.get<PublicMenusController>(PublicMenusController);
    service = module.get<MenusService>(MenusService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should call menusService.findAllPublic with correct query params', async () => {
      const query: ListPublicMenusQueryDto = { vendorId: 'vendor-1', isActive: false };
      await controller.findAll(query);
      expect(service.findAllPublic).toHaveBeenCalledWith('vendor-1', false);
    });

    it('should default isActive to true', async () => {
      const query: ListPublicMenusQueryDto = { vendorId: 'vendor-1' };
      await controller.findAll(query);
      expect(service.findAllPublic).toHaveBeenCalledWith('vendor-1', true);
    });
  });

  describe('findOne', () => {
    it('should call menusService.findOnePublic with menuId', async () => {
      await controller.findOne('menu-1');
      expect(service.findOnePublic).toHaveBeenCalledWith('menu-1');
    });
  });
});
