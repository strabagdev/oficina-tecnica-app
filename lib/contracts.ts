import "server-only";

import { DiscountMode, Prisma, UserRole } from "@prisma/client";
import {
  formatCurrencyDisplay,
  formatDecimalDisplay,
} from "@/lib/numeric";
import { getPrisma } from "@/lib/prisma";
import { resolveUserApprovalStatus } from "@/lib/user-approval-status";

type ContractDetailRecord = Prisma.ContractGetPayload<{
  include: {
    items: true;
    monthlyClosures: true;
    changes: true;
  };
}>;

type ClosureEntryPreview = {
  itemNumber: string;
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
  return formatCurrencyDisplay(value);
}

function formatQuantity(value: Prisma.Decimal | string | number | null | undefined) {
  return formatDecimalDisplay(value, { scale: 3, trimTrailingZeros: true });
}

function formatDateForInput(value: Date | null | undefined) {
  if (!value) {
    return "";
  }

  return value.toISOString().slice(0, 10);
}

function tokenizeItemNumber(value: string | null | undefined) {
  return (value ?? "")
    .split(/[^\dA-Za-z]+/)
    .filter(Boolean)
    .map((part) => (/^\d+$/.test(part) ? Number(part) : part.toLowerCase()));
}

function compareItemNumbers(left: string | null | undefined, right: string | null | undefined) {
  const leftTokens = tokenizeItemNumber(left);
  const rightTokens = tokenizeItemNumber(right);
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

  return (left ?? "").localeCompare(right ?? "", "es", {
    numeric: true,
    sensitivity: "base",
  });
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

export async function getContractListSnapshot() {
  const prisma = getPrisma();

  const contracts = await prisma.contract.findMany({
    orderBy: [
      {
        createdAt: "desc",
      },
    ],
    include: {
      _count: {
        select: {
          items: true,
          monthlyClosures: true,
          changes: true,
        },
      },
    },
  });

  return contracts.map((contract) => ({
    id: contract.id,
    code: contract.code,
    name: contract.name,
    clientName: contract.clientName,
    description: contract.description,
    descriptionValue: contract.description ?? "",
    currency: contract.currency,
    status: contract.status,
    statusValue: contract.status,
    startDateValue: formatDateForInput(contract.startDate),
    endDateValue: formatDateForInput(contract.endDate),
    originalAmount: formatCurrency(contract.originalAmount),
    itemCount: contract._count.items,
    closureCount: contract._count.monthlyClosures,
    pendingChanges: contract._count.changes,
  }));
}

export async function getContractDetailSnapshot(contractId: string) {
  const prisma = getPrisma();

  const contract: ContractDetailRecord | null = await prisma.contract.findUnique({
    where: {
      id: contractId,
    },
    include: {
      items: {
        orderBy: [
          { itemNumber: "asc" },
          { itemCode: "asc" },
        ],
      },
      monthlyClosures: {
        orderBy: [
          {
            year: "desc",
          },
          {
            month: "desc",
          },
        ],
        take: 6,
      },
      changes: {
        orderBy: {
          createdAt: "desc",
        },
        take: 10,
      },
    },
  });

  if (!contract) {
    return null;
  }

  const sortedItems = [...contract.items].sort((left, right) => {
    const itemNumberOrder = compareItemNumbers(left.itemNumber, right.itemNumber);

    if (itemNumberOrder !== 0) {
      return itemNumberOrder;
    }

    return compareItemNumbers(left.itemCode, right.itemCode);
  });

  const consumedQuantityByItem = new Map<string, Prisma.Decimal>();
  const consumedAmountByItem = new Map<string, Prisma.Decimal>();

  const consumptions = await prisma.monthlyConsumption.findMany({
    where: {
      contractItem: {
        contractId,
      },
    },
    select: {
      contractItemId: true,
      quantityConsumed: true,
      payableAmount: true,
      amountConsumed: true,
    },
  });

  for (const row of consumptions) {
    consumedQuantityByItem.set(
      row.contractItemId,
      (consumedQuantityByItem.get(row.contractItemId) ?? new Prisma.Decimal(0)).add(
        row.quantityConsumed,
      ),
    );
    consumedAmountByItem.set(
      row.contractItemId,
      (consumedAmountByItem.get(row.contractItemId) ?? new Prisma.Decimal(0)).add(
        row.payableAmount ?? row.amountConsumed,
      ),
    );
  }

  return {
    id: contract.id,
    code: contract.code,
    name: contract.name,
    clientName: contract.clientName,
    description: contract.description,
    descriptionValue: contract.description ?? "",
    currency: contract.currency,
    status: contract.status,
    statusValue: contract.status,
    startDateValue: formatDateForInput(contract.startDate),
    endDateValue: formatDateForInput(contract.endDate),
    originalAmount: formatCurrency(contract.originalAmount),
    itemCount: sortedItems.length,
    closureCount: contract.monthlyClosures.length,
    items: sortedItems.map((item: ContractDetailRecord["items"][number]) => ({
      id: item.id,
      family: item.family,
      subfamily: item.subfamily,
      itemGroup: item.itemGroup,
      itemNumber: item.itemNumber,
      itemCode: item.itemCode,
      itemNumberValue: item.itemNumber,
      itemCodeValue: item.itemCode,
      description: item.description,
      unit: item.unit,
      originalQuantityValue: item.originalQuantity.toFixed(3).replace(/\.?0+$/, ""),
      unitPriceValue: item.unitPrice.toFixed(2).replace(/\.?0+$/, ""),
      originalQuantity: formatQuantity(item.originalQuantity),
      unitPrice: formatCurrency(item.unitPrice),
      originalAmount: formatCurrency(item.originalAmount),
      consumedQuantity: formatQuantity(
        consumedQuantityByItem.get(item.id) ?? new Prisma.Decimal(0),
      ),
      consumedAmount: formatCurrency(
        consumedAmountByItem.get(item.id) ?? new Prisma.Decimal(0),
      ),
    })),
    closures: contract.monthlyClosures.map(
      (closure: ContractDetailRecord["monthlyClosures"][number]) => ({
      id: closure.id,
      periodLabel: `${String(closure.month).padStart(2, "0")}/${closure.year}`,
      statementNumber: closure.statementNumber ?? "Sin numero",
      grossAmount: formatCurrency(closure.grossAmount),
      totalDiscounts: formatCurrency(closure.totalDiscounts),
      netAmount: formatCurrency(closure.netAmount),
    })),
    changes: contract.changes.map((change: ContractDetailRecord["changes"][number]) => ({
      id: change.id,
      title: change.title,
      type: change.type,
      status: change.status,
      effectiveDate: new Intl.DateTimeFormat("es-CL").format(change.effectiveDate),
    })),
  };
}

export async function getUserAdminSnapshot() {
  const prisma = getPrisma();

  const users = await prisma.$queryRaw<
    {
      id: string;
      authUserId: string | null;
      name: string;
      email: string;
      role: string;
      approvalStatus: string;
      active: boolean;
    }[]
  >`
    select id, "authUserId", name, email, role::text, "approvalStatus"::text, active
    from "User"
    order by role asc, name asc
  `;

  return users.map((user) => ({
    id: user.id,
    authUserId: user.authUserId,
    name: user.name,
    email: user.email,
    role: user.role as UserRole,
    approvalStatus: resolveUserApprovalStatus(user.approvalStatus),
    active: user.active,
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
          itemNumber: "asc",
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
        itemNumber: item.itemNumber,
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
