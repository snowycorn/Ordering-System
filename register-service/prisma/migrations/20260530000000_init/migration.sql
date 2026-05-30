-- CreateTable
CREATE TABLE "pending_vendors" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "vendor_name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(50),
    "factory_zone" VARCHAR(100),
    "documents_url" TEXT,
    "status" VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    "review_notes" TEXT,
    "reviewed_by" VARCHAR(255),
    "reviewed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "pending_vendors_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pending_vendors_status_idx" ON "pending_vendors"("status");

-- CreateIndex
CREATE INDEX "pending_vendors_email_idx" ON "pending_vendors"("email");
