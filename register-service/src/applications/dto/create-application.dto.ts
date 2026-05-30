// src/applications/dto/create-application.dto.ts
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEmail,
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

  @IsOptional()
  @IsString()
  @MaxLength(100)
  factoryZone?: string;

  // 已上傳到私有 S3 Bucket 的營登 PDF object key（由 upload-url 端點回傳）
  @IsOptional()
  @IsString()
  @MaxLength(512)
  documentsKey?: string;
}
