import { IsOptional, IsString, IsArray, IsIn } from 'class-validator';
import { FACTORY_ZONES, FactoryZone } from '../factory-zones.constant';

// 管理員更新商家（PUT /api/v1/admin/vendors/:id）。
// 相較自管 UpdateVendorDto 多了 factoryZones：廠區僅 admin 可改。
// status 仍不可由此變更，停權/復權請用 POST /:id/suspend|reactivate。
export class AdminUpdateVendorDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @IsIn(FACTORY_ZONES, { each: true })
  factoryZones?: FactoryZone[];
}
