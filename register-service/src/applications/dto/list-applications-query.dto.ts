// src/applications/dto/list-applications-query.dto.ts
import { IsIn, IsOptional } from 'class-validator';

const APPLICATION_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const;
type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export class ListApplicationsQueryDto {
  // 依狀態過濾；不傳則回傳全部。福委會後台預設多看 PENDING。
  @IsOptional()
  @IsIn(APPLICATION_STATUSES, {
    message: `status 必須是以下之一：${APPLICATION_STATUSES.join(', ')}`,
  })
  status?: ApplicationStatus;
}
