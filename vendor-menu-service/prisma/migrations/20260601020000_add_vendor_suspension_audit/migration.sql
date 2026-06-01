-- AlterTable
ALTER TABLE "vendors"
  ADD COLUMN "suspended_at" TIMESTAMPTZ,
  ADD COLUMN "suspended_by" INTEGER,
  ADD COLUMN "suspend_reason" TEXT;
