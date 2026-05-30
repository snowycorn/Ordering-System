// src/applications/dto/reject-application.dto.ts
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ReviewApplicationDto {
  // 審核備註 / 駁回原因（選填）
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reviewNotes?: string;
}
