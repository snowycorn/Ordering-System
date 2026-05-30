// src/menus/dto/list-public-menus-query.dto.ts
import { IsOptional, IsString, IsUUID, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';

export class ListPublicMenusQueryDto {
  // 只查特定商家的菜單
  @IsOptional()
  @IsUUID()
  vendorId?: string;

  // 過濾啟用狀態（預設 true，Recommendation Service 只需要上架的菜單）
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  isActive?: boolean = true;
}
