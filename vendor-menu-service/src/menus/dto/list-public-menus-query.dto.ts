// src/menus/dto/list-public-menus-query.dto.ts
import { IsOptional, IsUUID, IsArray, IsIn, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { MENU_TAG_CODES, MenuTagCode } from '../menu-tags.constant';

export class ListPublicMenusQueryDto {
  // 只查特定商家的菜單
  @IsOptional()
  @IsUUID()
  vendorId?: string;

  // 依廠區過濾：只回「服務該廠區」商家的菜單（vendor.factoryZones 含此值）。
  // 供 Recommendation Service 取得某員工廠區可訂的菜單。
  // 維持單數（員工屬單一廠區）；不加 @IsIn，非法廠區只回空陣列不 400（同 ListVendorsQueryDto）。
  @IsOptional()
  @IsString()
  factoryZone?: string;

  // 注意：此端點刻意不提供 isActive 參數，永遠只回上架菜單，
  // 避免員工以 ?isActive=false 查到下架/未上架菜單。
  // 商家要看自己的（含下架）請走 owner-scoped 的 /api/v1/vendors/me/menus。

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
