-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'VIEWER');

-- CreateEnum
CREATE TYPE "UserApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ON_HOLD', 'CLOSED');

-- CreateEnum
CREATE TYPE "ChangeType" AS ENUM ('QUANTITY', 'AMOUNT', 'MIXED');

-- CreateEnum
CREATE TYPE "ChangeStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'APPLIED');

-- CreateEnum
CREATE TYPE "DiscountMode" AS ENUM ('NONE', 'PERCENTAGE', 'AMOUNT', 'QUANTITY');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "authUserId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "approvalStatus" "UserApprovalStatus" NOT NULL DEFAULT 'APPROVED',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "description" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "currency" TEXT NOT NULL DEFAULT 'CLP',
    "originalAmount" DECIMAL(18,2) NOT NULL,
    "status" "ContractStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeasurementUnit" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeasurementUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemFamily" (
    "id" TEXT NOT NULL,
    "contractId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "wbs" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ItemFamily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemSubfamily" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "wbs" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ItemSubfamily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemGroupCatalog" (
    "id" TEXT NOT NULL,
    "subfamilyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "wbs" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ItemGroupCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractItem" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "family" TEXT,
    "subfamily" TEXT,
    "itemGroup" TEXT,
    "itemNumber" TEXT NOT NULL,
    "itemCode" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "unit" TEXT,
    "originalQuantity" DECIMAL(18,3) NOT NULL,
    "unitPrice" DECIMAL(18,2) NOT NULL,
    "originalAmount" DECIMAL(18,2) NOT NULL,
    "currentQuantity" DECIMAL(18,3),
    "currentAmount" DECIMAL(18,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlyConsumption" (
    "id" TEXT NOT NULL,
    "contractItemId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "quantityConsumed" DECIMAL(18,3) NOT NULL,
    "amountConsumed" DECIMAL(18,2) NOT NULL,
    "discountMode" "DiscountMode" NOT NULL DEFAULT 'NONE',
    "discountPercent" DECIMAL(7,4),
    "discountQuantity" DECIMAL(18,3),
    "discountAmount" DECIMAL(18,2),
    "payableQuantity" DECIMAL(18,3),
    "payableAmount" DECIMAL(18,2),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthlyConsumption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlyClosure" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "statementNumber" TEXT,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "summaryNote" TEXT,
    "grossAmount" DECIMAL(18,2),
    "totalDiscounts" DECIMAL(18,2),
    "netAmount" DECIMAL(18,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthlyClosure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlyClosureItemSnapshot" (
    "id" TEXT NOT NULL,
    "monthlyClosureId" TEXT NOT NULL,
    "contractItemId" TEXT NOT NULL,
    "itemNumber" TEXT NOT NULL,
    "itemCode" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "unit" TEXT,
    "contractQuantity" DECIMAL(18,3) NOT NULL,
    "contractAmount" DECIMAL(18,2) NOT NULL,
    "consumedToDateQuantity" DECIMAL(18,3) NOT NULL,
    "consumedToDateAmount" DECIMAL(18,2) NOT NULL,
    "monthQuantity" DECIMAL(18,3) NOT NULL,
    "monthGrossAmount" DECIMAL(18,2) NOT NULL,
    "discountMode" "DiscountMode" NOT NULL DEFAULT 'NONE',
    "discountPercent" DECIMAL(7,4),
    "discountQuantity" DECIMAL(18,3),
    "discountAmount" DECIMAL(18,2),
    "netPayableQuantity" DECIMAL(18,3),
    "netPayableAmount" DECIMAL(18,2),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthlyClosureItemSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractChange" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "contractItemId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "ChangeType" NOT NULL,
    "status" "ChangeStatus" NOT NULL DEFAULT 'PENDING',
    "quantityDelta" DECIMAL(18,3),
    "amountDelta" DECIMAL(18,2),
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "appliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractChangeLine" (
    "id" TEXT NOT NULL,
    "contractChangeId" TEXT NOT NULL,
    "contractItemId" TEXT,
    "createsNewItem" BOOLEAN NOT NULL DEFAULT false,
    "family" TEXT,
    "subfamily" TEXT,
    "itemGroup" TEXT,
    "itemNumber" TEXT NOT NULL,
    "itemCode" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "unit" TEXT,
    "quantityDelta" DECIMAL(18,3),
    "amountDelta" DECIMAL(18,2) NOT NULL,
    "unitPrice" DECIMAL(18,2),
    "beforeQuantity" DECIMAL(18,3),
    "beforeAmount" DECIMAL(18,2),
    "afterQuantity" DECIMAL(18,3),
    "afterAmount" DECIMAL(18,2),
    "appliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractChangeLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_authUserId_key" ON "User"("authUserId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Contract_code_key" ON "Contract"("code");

-- CreateIndex
CREATE UNIQUE INDEX "MeasurementUnit_code_key" ON "MeasurementUnit"("code");

-- CreateIndex
CREATE INDEX "ItemFamily_contractId_idx" ON "ItemFamily"("contractId");

-- CreateIndex
CREATE UNIQUE INDEX "ItemFamily_contractId_code_key" ON "ItemFamily"("contractId", "code");

-- CreateIndex
CREATE INDEX "ItemSubfamily_familyId_idx" ON "ItemSubfamily"("familyId");

-- CreateIndex
CREATE UNIQUE INDEX "ItemSubfamily_familyId_code_key" ON "ItemSubfamily"("familyId", "code");

-- CreateIndex
CREATE INDEX "ItemGroupCatalog_subfamilyId_idx" ON "ItemGroupCatalog"("subfamilyId");

-- CreateIndex
CREATE UNIQUE INDEX "ItemGroupCatalog_subfamilyId_code_key" ON "ItemGroupCatalog"("subfamilyId", "code");

-- CreateIndex
CREATE INDEX "ContractItem_contractId_idx" ON "ContractItem"("contractId");

-- CreateIndex
CREATE UNIQUE INDEX "ContractItem_contractId_itemNumber_key" ON "ContractItem"("contractId", "itemNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ContractItem_contractId_itemCode_key" ON "ContractItem"("contractId", "itemCode");

-- CreateIndex
CREATE INDEX "MonthlyConsumption_year_month_idx" ON "MonthlyConsumption"("year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyConsumption_contractItemId_year_month_key" ON "MonthlyConsumption"("contractItemId", "year", "month");

-- CreateIndex
CREATE INDEX "MonthlyClosure_year_month_idx" ON "MonthlyClosure"("year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyClosure_contractId_year_month_key" ON "MonthlyClosure"("contractId", "year", "month");

-- CreateIndex
CREATE INDEX "MonthlyClosureItemSnapshot_contractItemId_idx" ON "MonthlyClosureItemSnapshot"("contractItemId");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyClosureItemSnapshot_monthlyClosureId_contractItemId_key" ON "MonthlyClosureItemSnapshot"("monthlyClosureId", "contractItemId");

-- CreateIndex
CREATE INDEX "ContractChange_contractId_idx" ON "ContractChange"("contractId");

-- CreateIndex
CREATE INDEX "ContractChange_contractItemId_idx" ON "ContractChange"("contractItemId");

-- CreateIndex
CREATE INDEX "ContractChange_status_idx" ON "ContractChange"("status");

-- CreateIndex
CREATE INDEX "ContractChangeLine_contractChangeId_idx" ON "ContractChangeLine"("contractChangeId");

-- CreateIndex
CREATE INDEX "ContractChangeLine_contractItemId_idx" ON "ContractChangeLine"("contractItemId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemFamily" ADD CONSTRAINT "ItemFamily_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemSubfamily" ADD CONSTRAINT "ItemSubfamily_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "ItemFamily"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemGroupCatalog" ADD CONSTRAINT "ItemGroupCatalog_subfamilyId_fkey" FOREIGN KEY ("subfamilyId") REFERENCES "ItemSubfamily"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractItem" ADD CONSTRAINT "ContractItem_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyConsumption" ADD CONSTRAINT "MonthlyConsumption_contractItemId_fkey" FOREIGN KEY ("contractItemId") REFERENCES "ContractItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyClosure" ADD CONSTRAINT "MonthlyClosure_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyClosureItemSnapshot" ADD CONSTRAINT "MonthlyClosureItemSnapshot_monthlyClosureId_fkey" FOREIGN KEY ("monthlyClosureId") REFERENCES "MonthlyClosure"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyClosureItemSnapshot" ADD CONSTRAINT "MonthlyClosureItemSnapshot_contractItemId_fkey" FOREIGN KEY ("contractItemId") REFERENCES "ContractItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractChange" ADD CONSTRAINT "ContractChange_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractChange" ADD CONSTRAINT "ContractChange_contractItemId_fkey" FOREIGN KEY ("contractItemId") REFERENCES "ContractItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractChangeLine" ADD CONSTRAINT "ContractChangeLine_contractChangeId_fkey" FOREIGN KEY ("contractChangeId") REFERENCES "ContractChange"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractChangeLine" ADD CONSTRAINT "ContractChangeLine_contractItemId_fkey" FOREIGN KEY ("contractItemId") REFERENCES "ContractItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
