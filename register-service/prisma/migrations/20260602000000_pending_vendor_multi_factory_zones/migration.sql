-- 將單一廠區欄位 factory_zone 轉為多廠區陣列 factory_zones（保留既有資料）
ALTER TABLE "pending_vendors" ADD COLUMN "factory_zones" TEXT[] NOT NULL DEFAULT '{}';
UPDATE "pending_vendors" SET "factory_zones" = ARRAY["factory_zone"] WHERE "factory_zone" IS NOT NULL;
ALTER TABLE "pending_vendors" DROP COLUMN "factory_zone";
