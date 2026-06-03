// src/vendors/dto/admin-list-vendors-query.dto.ts
import { IsOptional, IsString, IsIn } from 'class-validator';

export class AdminListVendorsQueryDto {
  // 依狀態過濾（不傳=全部，含 ACTIVE 與 SUSPENDED）
  @IsOptional()
  @IsIn(['ACTIVE', 'SUSPENDED'])
  status?: 'ACTIVE' | 'SUSPENDED';

  // 依廠區過濾（比對 factoryZones 陣列是否含此廠區）
  @IsOptional()
  @IsString()
  factoryZone?: string;
}
