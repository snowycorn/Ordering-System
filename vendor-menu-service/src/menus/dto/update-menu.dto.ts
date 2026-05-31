import { IsString, IsNumber, IsOptional, IsUrl, IsBoolean, IsInt, Min, IsArray, IsIn } from 'class-validator';
import { MENU_TAG_CODES, MenuTagCode } from '../menu-tags.constant';

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

  @IsOptional()
  @IsArray()
  @IsIn(MENU_TAG_CODES, { each: true })
  tags?: MenuTagCode[]; // 菜單標籤（可複選，限定 MENU_TAG_CODES）
}
