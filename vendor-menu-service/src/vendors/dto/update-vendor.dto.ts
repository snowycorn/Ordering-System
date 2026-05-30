import { IsOptional, IsString, IsArray } from 'class-validator';

export class UpdateVendorDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  factoryZone?: string;

  @IsOptional()
  @IsArray()
  allowedAreas?: string[];

  @IsOptional()
  @IsString()
  status?: string;
}
