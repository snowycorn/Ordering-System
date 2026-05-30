// src/menus/dto/get-upload-url.dto.ts
import { IsIn } from 'class-validator';

// 明確白名單允許的 MIME type，防止上傳非圖片
const ALLOWED_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
type AllowedContentType = (typeof ALLOWED_CONTENT_TYPES)[number];

export class GetUploadUrlDto {
  @IsIn(ALLOWED_CONTENT_TYPES, {
    message: `contentType 必須是以下之一：${ALLOWED_CONTENT_TYPES.join(', ')}`,
  })
  contentType: AllowedContentType;
}
