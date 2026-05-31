// src/menus/dto/list-public-menus-query.dto.ts
import { IsOptional, IsUUID, IsBoolean, IsArray, IsIn } from 'class-validator';
import { Transform } from 'class-transformer';
import { MENU_TAG_CODES, MenuTagCode } from '../menu-tags.constant';

export class ListPublicMenusQueryDto {
  // 只查特定商家的菜單
  @IsOptional()
  @IsUUID()
  vendorId?: string;

  // 過濾啟用狀態（預設 true，Recommendation Service 只需要上架的菜單）
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  isActive?: boolean = true;

  // 依 tag 過濾（AND 語意：菜單須同時含所有指定 tag）。
  // 支援 ?tags=BEEF 單值與 ?tags=BEEF&tags=SPICY 多值，皆正規化成陣列。
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined) return value;
    return Array.isArray(value) ? value : [value];
  })
  @IsArray()
  @IsIn(MENU_TAG_CODES, { each: true })
  tags?: MenuTagCode[];
}
