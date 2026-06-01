import { IsOptional, IsString } from 'class-validator';

// 商家自管 profile（PUT /api/v1/vendors/me）。
// 不含 factoryZones / status：廠區與狀態僅能由 admin 經 /admin/vendors* 變更。
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
}
