import { Module } from '@nestjs/common';
import { VendorsService } from './vendors.service';
import { PublicVendorsController } from './controllers/public-vendors.controller';
import { MeVendorsController } from './controllers/me-vendors.controller';
import { AdminVendorsController } from './controllers/admin-vendors.controller';

@Module({
  controllers: [
    MeVendorsController,      // /api/v1/vendors/me（精確路由優先）
    PublicVendorsController,  // /api/v1/vendors & /api/v1/vendors/:id/menus
    AdminVendorsController,   // /api/v1/admin/vendors
  ],
  providers: [VendorsService],
})
export class VendorsModule {}
