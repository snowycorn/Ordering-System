-- 為 menus 新增 tags 欄位（text[]，預設空陣列），存英文 tag code，可複選
ALTER TABLE "menus" ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
