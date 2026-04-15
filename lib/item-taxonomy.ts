import "server-only";

import { getPrisma } from "@/lib/prisma";

export async function getItemTaxonomyOptions() {
  const prisma = getPrisma();

  const [families, subfamilies, groups] = await Promise.all([
    prisma.itemFamily.findMany({
      where: {
        active: true,
      },
      orderBy: [{ wbs: "asc" }, { code: "asc" }],
    }),
    prisma.itemSubfamily.findMany({
      where: {
        active: true,
        family: {
          active: true,
        },
      },
      include: {
        family: true,
      },
      orderBy: [{ family: { wbs: "asc" } }, { wbs: "asc" }, { code: "asc" }],
    }),
    prisma.itemGroupCatalog.findMany({
      where: {
        active: true,
        subfamily: {
          active: true,
          family: {
            active: true,
          },
        },
      },
      include: {
        subfamily: {
          include: {
            family: true,
          },
        },
      },
      orderBy: [
        { subfamily: { family: { wbs: "asc" } } },
        { subfamily: { wbs: "asc" } },
        { wbs: "asc" },
        { code: "asc" },
      ],
    }),
  ]);

  return {
    families: families.map((family: (typeof families)[number]) => ({
      id: family.id,
      name: family.name,
      wbs: family.wbs,
    })),
    subfamilies: subfamilies.map((subfamily: (typeof subfamilies)[number]) => ({
      id: subfamily.id,
      familyId: subfamily.familyId,
      name: subfamily.name,
      wbs: subfamily.wbs,
      familyName: subfamily.family.name,
    })),
    groups: groups.map((group: (typeof groups)[number]) => ({
      id: group.id,
      subfamilyId: group.subfamilyId,
      name: group.name,
      wbs: group.wbs,
      subfamilyName: group.subfamily.name,
      familyId: group.subfamily.familyId,
    })),
  };
}

export async function getItemTaxonomySnapshot() {
  const prisma = getPrisma();

  return prisma.itemFamily.findMany({
    orderBy: [{ wbs: "asc" }, { code: "asc" }],
    include: {
      subfamilies: {
        orderBy: [{ wbs: "asc" }, { code: "asc" }],
        include: {
          groups: {
            orderBy: [{ wbs: "asc" }, { code: "asc" }],
          },
        },
      },
    },
  });
}
