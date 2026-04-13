import "server-only";

import { DiscountMode, Prisma } from "@prisma/client";
import { getPrisma } from "@/lib/prisma";

type ClosureEntryPreview = {
  itemCode: string;
  description: string;
  unit: string | null;
  quantityConsumed: string;
  grossAmount: string;
  discountMode: DiscountMode;
  discountDisplay: string;
  netAmount: string;
};

function formatCurrency(value: Prisma.Decimal | string | number | null | undefined) {
  if (value === null || value === undefined) {
    return "$ 0";
  }

  const numericValue =
    value instanceof Prisma.Decimal ? value.toNumber() : Number(value);

  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(numericValue) ? numericValue : 0);
}

function formatQuantity(value: Prisma.Decimal | string | number | null | undefined) {
  if (value === null || value === undefined) {
    return "0";
  }

  const numericValue =
    value instanceof Prisma.Decimal ? value.toNumber() : Number(value);

  return new Intl.NumberFormat("es-CL", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  }).format(Number.isFinite(numericValue) ? numericValue : 0);
}

function formatDiscount(
  mode: DiscountMode,
  percent: Prisma.Decimal | null,
  quantity: Prisma.Decimal | null,
  unit: string | null,
) {
  if (mode === DiscountMode.PERCENTAGE && percent) {
    return `${formatQuantity(percent)} %`;
  }

  if (mode === DiscountMode.QUANTITY && quantity) {
    return `${formatQuantity(quantity)} ${unit ?? ""}`.trim();
  }

  return "Sin descuento";
}

export async function getContractOptions() {
  const prisma = getPrisma();

  const contracts = await prisma.contract.findMany({
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      code: true,
      name: true,
      status: true,
      clientName: true,
      _count: {
        select: {
          items: true,
          monthlyClosures: true,
        },
      },
    },
  });

  return contracts.map((contract) => ({
    id: contract.id,
    code: contract.code,
    name: contract.name,
    clientName: contract.clientName,
    status: contract.status,
    itemCount: contract._count.items,
    closureCount: contract._count.monthlyClosures,
  }));
}

export async function getUserAdminSnapshot() {
  const prisma = getPrisma();

  const users = await prisma.user.findMany({
    orderBy: [
      {
        role: "asc",
      },
      {
        name: "asc",
      },
    ],
    include: {
      _count: {
        select: {
          sessions: true,
        },
      },
    },
  });

  return users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    active: user.active,
    sessionCount: user._count.sessions,
  }));
}

export async function getRecentClosures() {
  const prisma = getPrisma();

  const closures = await prisma.monthlyClosure.findMany({
    orderBy: [
      {
        year: "desc",
      },
      {
        month: "desc",
      },
      {
        createdAt: "desc",
      },
    ],
    take: 5,
    include: {
      contract: {
        select: {
          code: true,
          name: true,
        },
      },
      itemSnapshots: {
        orderBy: {
          itemCode: "asc",
        },
        take: 3,
      },
    },
  });

  return closures.map((closure) => ({
    id: closure.id,
    contractLabel: `${closure.contract.code} · ${closure.contract.name}`,
    periodLabel: `${String(closure.month).padStart(2, "0")}/${closure.year}`,
    statementNumber: closure.statementNumber ?? "Sin numero",
    grossAmount: formatCurrency(closure.grossAmount),
    totalDiscounts: formatCurrency(closure.totalDiscounts),
    netAmount: formatCurrency(closure.netAmount),
    entries: closure.itemSnapshots.map(
      (item): ClosureEntryPreview => ({
        itemCode: item.itemCode,
        description: item.description,
        unit: item.unit,
        quantityConsumed: formatQuantity(item.monthQuantity),
        grossAmount: formatCurrency(item.monthGrossAmount),
        discountMode: item.discountMode,
        discountDisplay: formatDiscount(
          item.discountMode,
          item.discountPercent,
          item.discountQuantity,
          item.unit,
        ),
        netAmount: formatCurrency(item.netPayableAmount),
      }),
    ),
  }));
}
