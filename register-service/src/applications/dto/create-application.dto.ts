// src/applications/dto/create-application.dto.ts
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEmail,
  IsArray,
  MaxLength,
} from 'class-validator';

/**
 * 外部商家送出入駐申請表單。
 * documentsKey 來自先前呼叫 upload-url 上傳 PDF 後拿到的 S3 object key。
 */
export class CreateApplicationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  vendorName: string;

  @IsEmail()
  @MaxLength(255)
  email: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  // 申請服務的廠區（可多個）。此處僅做結構驗證；
  // 合法廠區值由 vendor-menu 在核准建立商家時權威把關（@IsIn）。
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  factoryZones?: string[];

  // 已上傳到私有 S3 Bucket 的營登 PDF object key（由 upload-url 端點回傳）
  @IsOptional()
  @IsString()
  @MaxLength(512)
  documentsKey?: string;
}
