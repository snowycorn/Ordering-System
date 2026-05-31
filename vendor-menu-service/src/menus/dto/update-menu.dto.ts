import { IsString, IsNumber, IsOptional, IsUrl, IsBoolean, IsInt, Min } from 'class-validator';

export class UpdateMenuDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsNumber()
  price?: number;

  @IsOptional()
  @IsUrl()
  imageUrl?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  dailyLimit?: number; // 預設每日限量

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
