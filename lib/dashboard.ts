import "server-only";

import { getPrisma } from "@/lib/prisma";
import { getContractOptions, getRecentClosures } from "@/lib/contracts";

export async function getDashboardSnapshot() {
  const prisma = getPrisma();
  const [contracts, items, consumptions, pendingChanges, closures, contractOptions, recentClosures] =
    await Promise.all([
    prisma.contract.count(),
    prisma.contractItem.count(),
    prisma.monthlyConsumption.count(),
    prisma.contractChange.count({
      where: {
        status: "PENDING",
      },
    }),
    prisma.monthlyClosure.count(),
    getContractOptions(),
    getRecentClosures(),
  ]);

  return {
    contracts,
    items,
    consumptions,
    pendingChanges,
    closures,
    contractOptions,
    recentClosures,
    sampleContract: {
      code: "CT-2026-001",
      name: "Conservacion Vial Sector Norte",
      clientName: "Mandante Demo",
      currency: "CLP",
      originalAmount: "$ 480.000.000",
      lastClosure: {
        period: "Marzo 2026",
        statementNumber: "EP-03",
        grossAmount: "$ 38.400.000",
        discounts: "$ 2.150.000",
        netAmount: "$ 36.250.000",
      },
      discountRules: [
        "Porcentaje: descuento aplicado como fraccion del avance del item.",
        "Cantidad: descuento expresado en unidades del item, por ejemplo m3, m2 o gl.",
      ],
      sampleItems: [
        {
          itemCode: "1.1",
          description: "Movimiento de tierras",
          unit: "m3",
          budget: "$ 120.000.000",
          discountMode: "Cantidad",
        },
        {
          itemCode: "2.4",
          description: "Base granular",
          unit: "m2",
          budget: "$ 85.000.000",
          discountMode: "Porcentaje",
        },
        {
          itemCode: "5.2",
          description: "Senalizacion provisoria",
          unit: "gl",
          budget: "$ 12.500.000",
          discountMode: "Porcentaje",
        },
      ],
    },
  };
}
