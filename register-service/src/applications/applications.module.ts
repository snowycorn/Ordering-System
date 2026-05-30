// src/applications/applications.module.ts
import { Module } from '@nestjs/common';
import { ApplicationsService } from './applications.service';
import { PublicApplicationsController } from './controllers/public-applications.controller';
import { AdminApplicationsController } from './controllers/admin-applications.controller';
import { S3Module } from '../s3/s3.module';
import { IntegrationsModule } from '../integrations/integrations.module';

@Module({
  imports: [S3Module, IntegrationsModule],
  controllers: [PublicApplicationsController, AdminApplicationsController],
  providers: [ApplicationsService],
})
export class ApplicationsModule {}
