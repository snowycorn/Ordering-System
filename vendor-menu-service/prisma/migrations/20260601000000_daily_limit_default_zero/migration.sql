-- 將既有 NULL 的 daily_limit 補為 0，並把欄位改為 NOT NULL DEFAULT 0
UPDATE "menus" SET "daily_limit" = 0 WHERE "daily_limit" IS NULL;

ALTER TABLE "menus" ALTER COLUMN "daily_limit" SET DEFAULT 0;
ALTER TABLE "menus" ALTER COLUMN "daily_limit" SET NOT NULL;
