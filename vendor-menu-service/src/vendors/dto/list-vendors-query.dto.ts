// src/vendors/dto/list-vendors-query.dto.ts
import { IsOptional, IsString } from 'class-validator';

export class ListVendorsQueryDto {
  // 依廠區過濾，員工只看自己廠區的商家
  @IsOptional()
  @IsString()
  factoryZone?: string;
}
