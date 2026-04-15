import "server-only";

import { getPrisma } from "@/lib/prisma";

const DEFAULT_MEASUREMENT_UNITS = [
  { code: "m3", name: "Metro cubico", sortOrder: 10 },
  { code: "m2", name: "Metro cuadrado", sortOrder: 20 },
  { code: "ml", name: "Metro lineal", sortOrder: 30 },
  { code: "gl", name: "Global", sortOrder: 40 },
  { code: "kg", name: "Kilogramo", sortOrder: 50 },
  { code: "ton", name: "Tonelada", sortOrder: 60 },
  { code: "u", name: "Unidad", sortOrder: 70 },
];

export async function ensureMeasurementUnits() {
  const prisma = getPrisma();
  const count = await prisma.measurementUnit.count();

  if (count > 0) {
    return;
  }

  await prisma.measurementUnit.createMany({
    data: DEFAULT_MEASUREMENT_UNITS,
  });
}

export async function getMeasurementUnitOptions() {
  await ensureMeasurementUnits();
  const prisma = getPrisma();

  return prisma.measurementUnit.findMany({
    where: {
      active: true,
    },
    orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
  });
}

export async function getMeasurementUnitSnapshot() {
  await ensureMeasurementUnits();
  const prisma = getPrisma();

  return prisma.measurementUnit.findMany({
    orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
  });
}
