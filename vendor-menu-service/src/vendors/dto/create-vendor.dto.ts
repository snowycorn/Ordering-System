// src/vendors/dto/create-vendor.dto.ts
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  IsArray,
  IsIn,
  MaxLength,
} from 'class-validator';
import { FACTORY_ZONES, FactoryZone } from '../factory-zones.constant';

export class CreateVendorDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  // IAM 數字 userId，由 register-service 核准時帶入，供商家自管 /me* 路由解析
  @IsOptional()
  @IsInt()
  userId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @IsOptional()
  @IsString()
  description?: string;

  // 服務廠區（可多個），限定 FACTORY_ZONES 合法值
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @IsIn(FACTORY_ZONES, { each: true })
  factoryZones?: FactoryZone[];
}
