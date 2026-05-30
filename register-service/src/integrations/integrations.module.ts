// src/integrations/integrations.module.ts
import { Module } from '@nestjs/common';
import { IamClient } from './iam.client';
import { VendorMenuClient } from './vendor-menu.client';
import { MailerService } from './mailer.service';

@Module({
  providers: [IamClient, VendorMenuClient, MailerService],
  exports: [IamClient, VendorMenuClient, MailerService],
})
export class IntegrationsModule {}
