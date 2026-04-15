import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL no esta configurada. Define la variable antes de usar Prisma.",
    );
  }

  return new PrismaClient({
    adapter: new PrismaPg({
      connectionString,
    }),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

function hasLatestDelegates(prisma: PrismaClient) {
  return (
    "measurementUnit" in prisma &&
    "itemFamily" in prisma &&
    "itemSubfamily" in prisma &&
    "itemGroupCatalog" in prisma
  );
}

export function getPrisma() {
  if (globalForPrisma.prisma) {
    if (hasLatestDelegates(globalForPrisma.prisma)) {
      return globalForPrisma.prisma;
    }

    void globalForPrisma.prisma.$disconnect().catch(() => undefined);
    globalForPrisma.prisma = undefined;
  }

  const prisma = createPrismaClient();

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = prisma;
  }

  return prisma;
}
