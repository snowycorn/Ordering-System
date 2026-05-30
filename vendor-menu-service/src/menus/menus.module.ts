import { Module } from '@nestjs/common';
import { MenusController } from './menus.controller';
import { PublicMenusController } from './public-menus.controller';
import { MenusService } from './menus.service';
import { S3Module } from '../s3/s3.module';

@Module({
  imports: [S3Module],
  controllers: [MenusController, PublicMenusController],
  providers: [MenusService],
})
export class MenusModule {}
