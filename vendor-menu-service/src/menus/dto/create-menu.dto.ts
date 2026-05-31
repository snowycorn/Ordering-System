import { IsString, IsNumber, IsOptional, IsUrl, IsInt, Min, IsArray, IsIn } from 'class-validator';
import { MENU_TAG_CODES, MenuTagCode } from '../menu-tags.constant';

export class CreateMenuDto {
  @IsString()
  name: string;

  @IsNumber()
  price: number;

  @IsOptional()
  @IsUrl()
  imageUrl?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  dailyLimit?: number; // 預設每日限量；未帶時於 service 補 0

  @IsOptional()
  @IsArray()
  @IsIn(MENU_TAG_CODES, { each: true })
  tags?: MenuTagCode[]; // 菜單標籤（可複選，限定 MENU_TAG_CODES）
}
