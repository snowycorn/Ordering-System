import { Module } from '@nestjs/common';
import { MenusController } from './menus.controller';
import { PublicMenusController } from './public-menus.controller';
import { MenusService } from './menus.service';
import { InventorySyncService } from './inventory-sync.service';
import { OrderInventoryClient } from '../integrations/order-inventory.client';
import { S3Module } from '../s3/s3.module';
import { VendorsModule } from '../vendors/vendors.module';

@Module({
  imports: [S3Module, VendorsModule],
  controllers: [MenusController, PublicMenusController],
  providers: [MenusService, InventorySyncService, OrderInventoryClient],
})
export class MenusModule {}
