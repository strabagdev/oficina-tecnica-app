CREATE UNIQUE INDEX "MonthlyClosure_one_closed_per_period"
ON "MonthlyClosure" ("contractId", "year", "month")
WHERE "status" = 'CLOSED';
