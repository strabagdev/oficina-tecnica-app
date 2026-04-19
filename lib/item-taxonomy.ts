import "server-only";

import { getPrisma } from "@/lib/prisma";

type ItemTaxonomyScope = {
  contractId: string | null;
};

async function resolveItemTaxonomyScope(contractId?: string | null): Promise<ItemTaxonomyScope> {
  return {
    contractId: contractId ?? null,
  };
}

function tokenizeWbs(value: string | null | undefined) {
  return (value ?? "")
    .split(/[^\dA-Za-z]+/)
    .filter(Boolean)
    .map((part) => (/^\d+$/.test(part) ? Number(part) : part.toLowerCase()));
}

function compareWbsLike(
  left: string | null | undefined,
  right: string | null | undefined,
  leftFallback = "",
  rightFallback = "",
) {
  const leftTokens = tokenizeWbs(left);
  const rightTokens = tokenizeWbs(right);
  const length = Math.max(leftTokens.length, rightTokens.length);

  for (let index = 0; index < length; index += 1) {
    const leftToken = leftTokens[index];
    const rightToken = rightTokens[index];

    if (leftToken === undefined) {
      return -1;
    }

    if (rightToken === undefined) {
      return 1;
    }

    if (leftToken === rightToken) {
      continue;
    }

    if (typeof leftToken === "number" && typeof rightToken === "number") {
      return leftToken - rightToken;
    }

    return String(leftToken).localeCompare(String(rightToken), "es", {
      numeric: true,
      sensitivity: "base",
    });
  }

  return leftFallback.localeCompare(rightFallback, "es", {
    numeric: true,
    sensitivity: "base",
  });
}

function sortTaxonomyRows<T extends { wbs?: string | null; name: string }>(rows: T[]) {
  return [...rows].sort((left, right) =>
    compareWbsLike(left.wbs, right.wbs, left.name, right.name),
  );
}

export async function getItemTaxonomyOptions(contractId?: string | null) {
  const prisma = getPrisma();
  const scope = await resolveItemTaxonomyScope(contractId);

  const [families, subfamilies, groups] = await Promise.all([
    prisma.itemFamily.findMany({
      where: {
        active: true,
        contractId: scope.contractId,
      },
      orderBy: [{ createdAt: "asc" }],
    }),
    prisma.itemSubfamily.findMany({
      where: {
        active: true,
        family: {
          active: true,
          contractId: scope.contractId,
        },
      },
      include: {
        family: true,
      },
      orderBy: [{ createdAt: "asc" }],
    }),
    prisma.itemGroupCatalog.findMany({
      where: {
        active: true,
        subfamily: {
          active: true,
          family: {
            active: true,
            contractId: scope.contractId,
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
      orderBy: [{ createdAt: "asc" }],
    }),
  ]);

  const sortedFamilies = sortTaxonomyRows(families);
  const sortedSubfamilies = [...subfamilies].sort((left, right) => {
    const familyOrder = compareWbsLike(
      left.family.wbs,
      right.family.wbs,
      left.family.name,
      right.family.name,
    );

    if (familyOrder !== 0) {
      return familyOrder;
    }

    return compareWbsLike(left.wbs, right.wbs, left.name, right.name);
  });
  const sortedGroups = [...groups].sort((left, right) => {
    const familyOrder = compareWbsLike(
      left.subfamily.family.wbs,
      right.subfamily.family.wbs,
      left.subfamily.family.name,
      right.subfamily.family.name,
    );

    if (familyOrder !== 0) {
      return familyOrder;
    }

    const subfamilyOrder = compareWbsLike(
      left.subfamily.wbs,
      right.subfamily.wbs,
      left.subfamily.name,
      right.subfamily.name,
    );

    if (subfamilyOrder !== 0) {
      return subfamilyOrder;
    }

    return compareWbsLike(left.wbs, right.wbs, left.name, right.name);
  });

  return {
    scope,
    families: sortedFamilies.map((family: (typeof families)[number]) => ({
      id: family.id,
      name: family.name,
      wbs: family.wbs,
    })),
    subfamilies: sortedSubfamilies.map((subfamily: (typeof subfamilies)[number]) => ({
      id: subfamily.id,
      familyId: subfamily.familyId,
      name: subfamily.name,
      wbs: subfamily.wbs,
      familyName: subfamily.family.name,
    })),
    groups: sortedGroups.map((group: (typeof groups)[number]) => ({
      id: group.id,
      subfamilyId: group.subfamilyId,
      name: group.name,
      wbs: group.wbs,
      subfamilyName: group.subfamily.name,
      familyId: group.subfamily.familyId,
    })),
  };
}

export async function getItemTaxonomySnapshot(contractId?: string | null) {
  const prisma = getPrisma();
  const scope = await resolveItemTaxonomyScope(contractId);

  const families = await prisma.itemFamily.findMany({
    where: {
      contractId: scope.contractId,
    },
    orderBy: [{ createdAt: "asc" }],
    include: {
      subfamilies: {
        orderBy: [{ createdAt: "asc" }],
        include: {
          groups: {
            orderBy: [{ createdAt: "asc" }],
          },
        },
      },
    },
  });

  return sortTaxonomyRows(families).map((family) => ({
    ...family,
    subfamilies: sortTaxonomyRows(family.subfamilies).map((subfamily) => ({
      ...subfamily,
      groups: sortTaxonomyRows(subfamily.groups),
    })),
  }));
}
