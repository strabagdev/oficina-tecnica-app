import "server-only";

import { getPrisma } from "@/lib/prisma";
import {
  getContractOptions,
  getRecentClosures,
  getUserAdminSnapshot,
} from "@/lib/contracts";

export async function getDashboardSnapshot() {
  const prisma = getPrisma();
  const [
    contracts,
    items,
    consumptions,
    pendingChanges,
    closures,
    contractOptions,
    recentClosures,
    users,
  ] =
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
    getUserAdminSnapshot(),
  ]);

  return {
    contracts,
    items,
    consumptions,
    pendingChanges,
    closures,
    contractOptions,
    recentClosures,
    users,
  };
}
