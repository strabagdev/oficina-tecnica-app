-- Backfill seguro para separar valores originales y vigentes en ContractItem.
-- Idempotente: se puede ejecutar mas de una vez sin sobrescribir NOC ya aplicadas.

BEGIN;

ALTER TABLE "ContractItem"
  ADD COLUMN IF NOT EXISTS "currentQuantity" DECIMAL(18, 3);

ALTER TABLE "ContractItem"
  ADD COLUMN IF NOT EXISTS "currentAmount" DECIMAL(18, 2);

UPDATE "ContractItem"
SET
  "currentQuantity" = COALESCE("currentQuantity", "originalQuantity"),
  "currentAmount" = COALESCE("currentAmount", "originalAmount")
WHERE
  "currentQuantity" IS NULL
  OR "currentAmount" IS NULL;

COMMIT;

-- Verificacion esperada despues de ejecutar:
-- SELECT COUNT(*) AS items_pendientes
-- FROM "ContractItem"
-- WHERE "currentQuantity" IS NULL OR "currentAmount" IS NULL;
--
-- Debe devolver 0 antes de convertir estos campos en NOT NULL.
