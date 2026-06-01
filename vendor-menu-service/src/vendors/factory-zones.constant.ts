// 廠區清單的單一真實來源（single source of truth）。
// 新增/移除廠區只改這裡：DTO @IsIn 驗證白名單、GET /api/v1/factory-zones 端點輸出皆引用此處。
// 下游服務（如 register-service）不應自行 hardcode，而是呼叫 GET /api/v1/factory-zones 取得。
export const FACTORY_ZONES = ['A廠', 'B廠', 'C廠'] as const;

export type FactoryZone = (typeof FACTORY_ZONES)[number];
