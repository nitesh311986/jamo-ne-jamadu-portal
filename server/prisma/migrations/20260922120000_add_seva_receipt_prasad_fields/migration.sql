BEGIN;

-- Add Prasad distribution columns to SevaReceipt
ALTER TABLE "SevaReceipt" ADD COLUMN IF NOT EXISTS "prasadDistributed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "SevaReceipt" ADD COLUMN IF NOT EXISTS "boxesAllocated" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "SevaReceipt" ADD COLUMN IF NOT EXISTS "distributedAt" TIMESTAMP(3);
ALTER TABLE "SevaReceipt" ADD COLUMN IF NOT EXISTS "distributedBy" TEXT;

-- Add receipt tally columns to PrasadDistribution
ALTER TABLE "PrasadDistribution" ADD COLUMN IF NOT EXISTS "totalReceiptsCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "PrasadDistribution" ADD COLUMN IF NOT EXISTS "servedReceiptsCount" INTEGER NOT NULL DEFAULT 0;

-- Index used by Prasad distribution queries
CREATE INDEX IF NOT EXISTS "SevaReceipt_prasadDistributed_idx" ON "SevaReceipt"("prasadDistributed");

COMMIT;
