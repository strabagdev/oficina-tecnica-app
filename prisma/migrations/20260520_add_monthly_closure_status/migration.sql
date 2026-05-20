-- CreateEnum
CREATE TYPE "MonthlyClosureStatus" AS ENUM ('CLOSED', 'REPLACED');

-- DropIndex
DROP INDEX "MonthlyClosure_contractId_year_month_key";

-- AlterTable
ALTER TABLE "MonthlyClosure" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "replacedAt" TIMESTAMP(3),
ADD COLUMN     "replacedById" TEXT,
ADD COLUMN     "sourceClosureId" TEXT,
ADD COLUMN     "status" "MonthlyClosureStatus" NOT NULL DEFAULT 'CLOSED',
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex
CREATE INDEX "MonthlyClosure_status_idx" ON "MonthlyClosure"("status");

-- CreateIndex
CREATE INDEX "MonthlyClosure_replacedById_idx" ON "MonthlyClosure"("replacedById");

-- CreateIndex
CREATE INDEX "MonthlyClosure_sourceClosureId_idx" ON "MonthlyClosure"("sourceClosureId");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyClosure_contractId_year_month_version_key" ON "MonthlyClosure"("contractId", "year", "month", "version");

-- AddForeignKey
ALTER TABLE "MonthlyClosure" ADD CONSTRAINT "MonthlyClosure_replacedById_fkey" FOREIGN KEY ("replacedById") REFERENCES "MonthlyClosure"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyClosure" ADD CONSTRAINT "MonthlyClosure_sourceClosureId_fkey" FOREIGN KEY ("sourceClosureId") REFERENCES "MonthlyClosure"("id") ON DELETE SET NULL ON UPDATE CASCADE;
