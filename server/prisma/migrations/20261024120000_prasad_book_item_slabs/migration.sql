-- Prasad Vitran: move PrasadDistribution from per-tier slabs to per-book item quantities.
-- Note: legacy slab-tier columns are dropped; their data cannot be mapped to the
-- book-level item model and is discarded.

-- DropIndex
DROP INDEX IF EXISTS "PrasadDistribution_sevakId_slabTier_key";

-- AlterTable
ALTER TABLE "PrasadDistribution"
  DROP COLUMN IF EXISTS "slabTier",
  DROP COLUMN IF EXISTS "eligibleBoxes",
  DROP COLUMN IF EXISTS "distributedBoxes",
  DROP COLUMN IF EXISTS "totalReceiptsCount",
  DROP COLUMN IF EXISTS "servedReceiptsCount",
  ADD COLUMN IF NOT EXISTS "bookNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "eligibleSmall" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "eligibleBig" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "eligibleBiscuit" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "eligibleChocolate" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "distributedSmall" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "distributedBig" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "distributedBiscuit" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "distributedChocolate" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "collectedByName" TEXT,
  ADD COLUMN IF NOT EXISTS "collectedByMobile" TEXT,
  ADD COLUMN IF NOT EXISTS "distributedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "distributedBy" TEXT,
  ADD COLUMN IF NOT EXISTS "notes" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PrasadDistribution_sevakId_bookNumber_key" ON "PrasadDistribution"("sevakId", "bookNumber");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PrasadDistribution_bookNumber_idx" ON "PrasadDistribution"("bookNumber");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PrasadDistribution_collectedByName_idx" ON "PrasadDistribution"("collectedByName");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PrasadDistribution_collectedByMobile_idx" ON "PrasadDistribution"("collectedByMobile");
