import { IsOptional, IsString, IsUrl } from 'class-validator';

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

  // 商家圖片公開 URL（由 GET /me/upload-image-url 取得 pre-signed URL 上傳 S3 後存入）
  @IsOptional()
  @IsUrl()
  imageUrl?: string;
}
