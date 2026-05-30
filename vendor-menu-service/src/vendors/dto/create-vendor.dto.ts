// src/vendors/dto/create-vendor.dto.ts
import { IsString, IsNotEmpty, IsOptional, IsArray, IsInt, MaxLength } from 'class-validator';

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

  @IsOptional()
  @IsString()
  @MaxLength(100)
  factoryZone?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedAreas?: string[];
}
