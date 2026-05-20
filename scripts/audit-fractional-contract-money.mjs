import { Prisma, PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("DATABASE_URL no esta definido. Ejecuta con: npm run audit:money");
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

function isFractional(value) {
  return !new Prisma.Decimal(value ?? 0).isInteger();
}

function decimalToString(value) {
  return value === null || value === undefined ? "" : value.toString();
}

try {
  const items = await prisma.contractItem.findMany({
    select: {
      itemNumber: true,
      itemCode: true,
      description: true,
      unit: true,
      originalQuantity: true,
      unitPrice: true,
      originalAmount: true,
      currentQuantity: true,
      currentAmount: true,
      contract: {
        select: {
          code: true,
          currency: true,
        },
      },
    },
    orderBy: [{ contractId: "asc" }, { itemNumber: "asc" }],
  });

  const rows = items
    .filter(
      (item) =>
        item.contract.currency === "CLP" &&
        (isFractional(item.unitPrice) ||
          isFractional(item.originalAmount) ||
          (item.currentAmount !== null && isFractional(item.currentAmount))),
    )
    .map((item) => ({
      contrato: item.contract.code,
      item: item.itemCode || item.itemNumber,
      unidad: item.unit ?? "",
      cantidad: decimalToString(item.originalQuantity),
      precioUnitario: decimalToString(item.unitPrice),
      montoOriginal: decimalToString(item.originalAmount),
      cantidadVigente: decimalToString(item.currentQuantity),
      montoVigente: decimalToString(item.currentAmount),
      descripcion: item.description,
    }));

  console.log(`Partidas revisadas: ${items.length}`);
  console.log(`Partidas CLP con dinero fraccionario: ${rows.length}`);

  if (rows.length > 0) {
    console.table(rows.slice(0, 50));
  }
} finally {
  await prisma.$disconnect();
}
