import { Module } from '@nestjs/common';
import { VendorsService } from './vendors.service';
import { PublicVendorsController } from './controllers/public-vendors.controller';
import { MeVendorsController } from './controllers/me-vendors.controller';
import { AdminVendorsController } from './controllers/admin-vendors.controller';
import { FactoryZonesController } from './controllers/factory-zones.controller';
import { ActiveVendorGuard } from '../common/guards/active-vendor.guard';
import { S3Module } from '../s3/s3.module';

@Module({
  imports: [S3Module], // MeVendorsController 圖片上傳需要 S3Service
  controllers: [
    MeVendorsController,      // /api/v1/vendors/me（精確路由優先）
    FactoryZonesController,   // /api/v1/vendors/factory-zones（精確路由優先）
    PublicVendorsController,  // /api/v1/vendors & /api/v1/vendors/:id/menus
    AdminVendorsController,   // /api/v1/admin/vendors
  ],
  providers: [VendorsService, ActiveVendorGuard],
  exports: [VendorsService],
})
export class VendorsModule {}
