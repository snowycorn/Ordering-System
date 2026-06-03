import { Test, TestingModule } from '@nestjs/testing';
import { MeVendorsController } from './me-vendors.controller';
import { VendorsService } from '../vendors.service';
import { S3Service } from '../../s3/s3.service';
import { UpdateVendorDto } from '../dto/update-vendor.dto';
import { GetUploadUrlDto } from '../../menus/dto/get-upload-url.dto';

describe('MeVendorsController', () => {
  let controller: MeVendorsController;
  let service: VendorsService;
  let s3Service: S3Service;

  const mockVendorsService = {
    findOne: jest.fn(),
    findByUserId: jest.fn(),
    update: jest.fn(),
  };

  const mockS3Service = {
    generateVendorImageUploadUrl: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MeVendorsController],
      providers: [
        { provide: VendorsService, useValue: mockVendorsService },
        { provide: S3Service, useValue: mockS3Service },
      ],
    }).compile();

    controller = module.get<MeVendorsController>(MeVendorsController);
    service = module.get<VendorsService>(VendorsService);
    s3Service = module.get<S3Service>(S3Service);
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

  describe('getUploadImageUrl', () => {
    it('should resolve x-user-id and call s3Service with vendor.id', async () => {
      mockVendorsService.findByUserId.mockResolvedValue({ id: 'vendor-uuid' });
      mockS3Service.generateVendorImageUploadUrl.mockResolvedValue({
        uploadUrl: 'https://s3/put',
        imageUrl: 'https://cdn/vendor-images/vendor-uuid/x.jpg',
        expiresIn: 300,
      });
      const query: GetUploadUrlDto = { contentType: 'image/jpeg' };
      await controller.getUploadImageUrl('42', query);
      expect(service.findByUserId).toHaveBeenCalledWith(42);
      expect(s3Service.generateVendorImageUploadUrl).toHaveBeenCalledWith(
        'vendor-uuid',
        'image/jpeg',
      );
    });
  });
});
