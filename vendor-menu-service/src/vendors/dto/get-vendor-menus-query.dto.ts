// src/vendors/dto/get-vendor-menus-query.dto.ts
import { IsOptional, IsDateString } from 'class-validator';

export class GetVendorMenusQueryDto {
  // 指定查詢日期（預設為今天），格式 YYYY-MM-DD
  // 讓前端可以提前查詢明天的菜單
  @IsOptional()
  @IsDateString()
  date?: string;
}
