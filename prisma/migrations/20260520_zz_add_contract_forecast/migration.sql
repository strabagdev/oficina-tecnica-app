-- CreateEnum
CREATE TYPE "ContractForecastStatus" AS ENUM ('DRAFT', 'APPROVED', 'ARCHIVED', 'OUTDATED');

-- CreateEnum
CREATE TYPE "ContractForecastLineKind" AS ENUM ('REAL', 'FORECAST');

-- CreateEnum
CREATE TYPE "ContractForecastLineSource" AS ENUM ('AUTO', 'MANUAL');

-- CreateTable
CREATE TABLE "ContractForecast" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "status" "ContractForecastStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "startYear" INTEGER NOT NULL,
    "startMonth" INTEGER NOT NULL,
    "lastClosedYear" INTEGER,
    "lastClosedMonth" INTEGER,
    "currentContractAmount" DECIMAL(18,2) NOT NULL,
    "edpAccumulatedAmount" DECIMAL(18,2) NOT NULL,
    "remainingAmount" DECIMAL(18,2) NOT NULL,
    "totalForecastAmount" DECIMAL(18,2) NOT NULL,
    "differenceAmount" DECIMAL(18,2) NOT NULL,
    "estimatedCloseYear" INTEGER,
    "estimatedCloseMonth" INTEGER,
    "approvedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractForecast_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractForecastLine" (
    "id" TEXT NOT NULL,
    "forecastId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "kind" "ContractForecastLineKind" NOT NULL,
    "source" "ContractForecastLineSource" NOT NULL DEFAULT 'AUTO',
    "amount" DECIMAL(18,2) NOT NULL,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractForecastLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractForecastSnapshot" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "forecastId" TEXT,
    "version" INTEGER NOT NULL,
    "status" "ContractForecastStatus" NOT NULL DEFAULT 'APPROVED',
    "startYear" INTEGER NOT NULL,
    "startMonth" INTEGER NOT NULL,
    "lastClosedYear" INTEGER,
    "lastClosedMonth" INTEGER,
    "currentContractAmount" DECIMAL(18,2) NOT NULL,
    "edpAccumulatedAmount" DECIMAL(18,2) NOT NULL,
    "remainingAmount" DECIMAL(18,2) NOT NULL,
    "totalForecastAmount" DECIMAL(18,2) NOT NULL,
    "differenceAmount" DECIMAL(18,2) NOT NULL,
    "estimatedCloseYear" INTEGER,
    "estimatedCloseMonth" INTEGER,
    "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractForecastSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractForecastSnapshotLine" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "kind" "ContractForecastLineKind" NOT NULL,
    "source" "ContractForecastLineSource" NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractForecastSnapshotLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContractForecast_contractId_idx" ON "ContractForecast"("contractId");

-- CreateIndex
CREATE INDEX "ContractForecast_status_idx" ON "ContractForecast"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ContractForecast_contractId_version_key" ON "ContractForecast"("contractId", "version");

-- CreateIndex
CREATE INDEX "ContractForecastLine_forecastId_idx" ON "ContractForecastLine"("forecastId");

-- CreateIndex
CREATE INDEX "ContractForecastLine_year_month_idx" ON "ContractForecastLine"("year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "ContractForecastLine_forecastId_year_month_key" ON "ContractForecastLine"("forecastId", "year", "month");

-- CreateIndex
CREATE INDEX "ContractForecastSnapshot_contractId_idx" ON "ContractForecastSnapshot"("contractId");

-- CreateIndex
CREATE INDEX "ContractForecastSnapshot_forecastId_idx" ON "ContractForecastSnapshot"("forecastId");

-- CreateIndex
CREATE INDEX "ContractForecastSnapshotLine_snapshotId_idx" ON "ContractForecastSnapshotLine"("snapshotId");

-- CreateIndex
CREATE INDEX "ContractForecastSnapshotLine_year_month_idx" ON "ContractForecastSnapshotLine"("year", "month");

-- AddForeignKey
ALTER TABLE "ContractForecast" ADD CONSTRAINT "ContractForecast_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractForecastLine" ADD CONSTRAINT "ContractForecastLine_forecastId_fkey" FOREIGN KEY ("forecastId") REFERENCES "ContractForecast"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractForecastSnapshot" ADD CONSTRAINT "ContractForecastSnapshot_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractForecastSnapshot" ADD CONSTRAINT "ContractForecastSnapshot_forecastId_fkey" FOREIGN KEY ("forecastId") REFERENCES "ContractForecast"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractForecastSnapshotLine" ADD CONSTRAINT "ContractForecastSnapshotLine_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "ContractForecastSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
