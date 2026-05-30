// src/vendors/dto/create-vendor.dto.ts
import { IsString, IsNotEmpty, IsOptional, IsArray, MaxLength } from 'class-validator';

export class CreateVendorDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

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
