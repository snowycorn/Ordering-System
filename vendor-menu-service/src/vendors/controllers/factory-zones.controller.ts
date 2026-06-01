import { Controller, Get } from '@nestjs/common';
import { FACTORY_ZONES } from '../factory-zones.constant';

/**
 * 公開查詢端點：廠區清單（員工端 / 註冊表單 / register-service 取用）
 * - 不需要任何 Header，無須身份驗證
 * - 廠區詞彙的單一真實來源由 factory-zones.constant.ts 提供
 */
@Controller('api/v1/factory-zones')
export class FactoryZonesController {
  /**
   * GET /api/v1/factory-zones
   * 回傳所有合法廠區清單。
   */
  @Get()
  getFactoryZones() {
    return FACTORY_ZONES;
  }
}
