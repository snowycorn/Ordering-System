import { Module } from '@nestjs/common';
import { MenusController } from './menus.controller';
import { PublicMenusController } from './public-menus.controller';
import { AdminVendorSuspensionController } from './admin-vendor-suspension.controller';
import { MenusService } from './menus.service';
import { InventorySyncService } from './inventory-sync.service';
import { OrderInventoryClient } from '../integrations/order-inventory.client';
import { ActiveVendorGuard } from '../common/guards/active-vendor.guard';
import { S3Module } from '../s3/s3.module';
import { VendorsModule } from '../vendors/vendors.module';

@Module({
  imports: [S3Module, VendorsModule],
  controllers: [MenusController, PublicMenusController, AdminVendorSuspensionController],
  providers: [MenusService, InventorySyncService, OrderInventoryClient, ActiveVendorGuard],
})
export class MenusModule {}
