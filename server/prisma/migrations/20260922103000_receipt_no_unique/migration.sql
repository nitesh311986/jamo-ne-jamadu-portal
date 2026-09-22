-- Delete duplicates, keeping the earliest created record per receiptNo
DELETE FROM "SevaReceipt"
WHERE id NOT IN (
  SELECT DISTINCT ON ("receiptNo") id
  FROM "SevaReceipt"
  ORDER BY "receiptNo", "createdAt" ASC, id ASC
);

-- DropIndex
DROP INDEX "SevaReceipt_bookNumber_receiptNo_key";

-- CreateIndex
CREATE UNIQUE INDEX "SevaReceipt_receiptNo_key" ON "SevaReceipt"("receiptNo");
