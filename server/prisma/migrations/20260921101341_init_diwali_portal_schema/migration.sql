-- CreateEnum
CREATE TYPE "RoleName" AS ENUM ('SUPER_ADMIN', 'VOLUNTEER');

-- CreateEnum
CREATE TYPE "BookStatus" AS ENUM ('ASSIGNED', 'SUBMITTED', 'PARTIALLY_SUBMITTED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phoneNumber" TEXT,
    "role" "RoleName" NOT NULL DEFAULT 'VOLUNTEER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" JSONB NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sevak" (
    "id" TEXT NOT NULL,
    "sevakCode" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "altMobile" TEXT,
    "whatsapp" TEXT,
    "address" TEXT NOT NULL,
    "mandal" TEXT NOT NULL,
    "kshetra" TEXT NOT NULL,
    "expectedContacts" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sevak_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookAllocation" (
    "id" TEXT NOT NULL,
    "bookNumber" TEXT NOT NULL,
    "sevakId" TEXT NOT NULL,
    "status" "BookStatus" NOT NULL DEFAULT 'ASSIGNED',
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SevaReceipt" (
    "id" TEXT NOT NULL,
    "sevakId" TEXT NOT NULL,
    "bookNumber" TEXT NOT NULL,
    "receiptNo" TEXT NOT NULL,
    "donorName" TEXT NOT NULL,
    "donorMobile" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "entryDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SevaReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrasadDistribution" (
    "id" TEXT NOT NULL,
    "sevakId" TEXT NOT NULL,
    "slabTier" TEXT NOT NULL,
    "eligibleBoxes" INTEGER NOT NULL DEFAULT 0,
    "distributedBoxes" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrasadDistribution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "AuditLog_userId_timestamp_idx" ON "AuditLog"("userId", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "Sevak_sevakCode_key" ON "Sevak"("sevakCode");

-- CreateIndex
CREATE INDEX "Sevak_mobile_idx" ON "Sevak"("mobile");

-- CreateIndex
CREATE INDEX "Sevak_fullName_idx" ON "Sevak"("fullName");

-- CreateIndex
CREATE INDEX "Sevak_sevakCode_idx" ON "Sevak"("sevakCode");

-- CreateIndex
CREATE UNIQUE INDEX "BookAllocation_bookNumber_key" ON "BookAllocation"("bookNumber");

-- CreateIndex
CREATE INDEX "BookAllocation_bookNumber_idx" ON "BookAllocation"("bookNumber");

-- CreateIndex
CREATE INDEX "BookAllocation_sevakId_idx" ON "BookAllocation"("sevakId");

-- CreateIndex
CREATE INDEX "SevaReceipt_receiptNo_idx" ON "SevaReceipt"("receiptNo");

-- CreateIndex
CREATE INDEX "SevaReceipt_bookNumber_idx" ON "SevaReceipt"("bookNumber");

-- CreateIndex
CREATE INDEX "SevaReceipt_donorName_idx" ON "SevaReceipt"("donorName");

-- CreateIndex
CREATE INDEX "SevaReceipt_sevakId_idx" ON "SevaReceipt"("sevakId");

-- CreateIndex
CREATE UNIQUE INDEX "SevaReceipt_bookNumber_receiptNo_key" ON "SevaReceipt"("bookNumber", "receiptNo");

-- CreateIndex
CREATE INDEX "PrasadDistribution_sevakId_idx" ON "PrasadDistribution"("sevakId");

-- CreateIndex
CREATE UNIQUE INDEX "PrasadDistribution_sevakId_slabTier_key" ON "PrasadDistribution"("sevakId", "slabTier");

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookAllocation" ADD CONSTRAINT "BookAllocation_sevakId_fkey" FOREIGN KEY ("sevakId") REFERENCES "Sevak"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SevaReceipt" ADD CONSTRAINT "SevaReceipt_sevakId_fkey" FOREIGN KEY ("sevakId") REFERENCES "Sevak"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrasadDistribution" ADD CONSTRAINT "PrasadDistribution_sevakId_fkey" FOREIGN KEY ("sevakId") REFERENCES "Sevak"("id") ON DELETE CASCADE ON UPDATE CASCADE;
