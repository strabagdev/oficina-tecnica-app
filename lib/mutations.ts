import "server-only";

import { ContractStatus, DiscountMode, Prisma } from "@prisma/client";
import { getPrisma } from "@/lib/prisma";

type ParsedItemLine = {
  itemCode: string;
  description: string;
  unit: string;
  quantity: string;
  unitPrice: string;
};

type ParsedClosureLine = {
  itemCode: string;
  quantityConsumed: string;
  discountMode: DiscountMode;
  discountValue: string;
  note: string;
};

type ParsedItemsResult =
  | {
      error: string;
    }
  | {
      items: ParsedItemLine[];
    };

type ParsedClosureRowsResult =
  | {
      error: string;
    }
  | {
      rows: ParsedClosureLine[];
    };

type MutationResult = {
  error: string;
} | {
  success: string;
};

type ConsumptionMutationRow = {
  contractItemId: string;
  year: number;
  month: number;
  quantityConsumed: Prisma.Decimal;
  amountConsumed: Prisma.Decimal;
  discountMode: DiscountMode;
  discountPercent: Prisma.Decimal | null;
  discountQuantity: Prisma.Decimal | null;
  discountAmount: Prisma.Decimal;
  payableQuantity: Prisma.Decimal;
  payableAmount: Prisma.Decimal;
  note: string | null;
};

type ClosureSnapshotMutationRow = {
  contractItemId: string;
  itemCode: string;
  description: string;
  unit: string | null;
  contractQuantity: Prisma.Decimal;
  contractAmount: Prisma.Decimal;
  consumedToDateQuantity: Prisma.Decimal;
  consumedToDateAmount: Prisma.Decimal;
  monthQuantity: Prisma.Decimal;
  monthGrossAmount: Prisma.Decimal;
  discountMode: DiscountMode;
  discountPercent: Prisma.Decimal | null;
  discountQuantity: Prisma.Decimal | null;
  discountAmount: Prisma.Decimal;
  netPayableQuantity: Prisma.Decimal;
  netPayableAmount: Prisma.Decimal;
};

function parseDecimal(value: string) {
  const normalized = value.replace(/\s/g, "").replace(",", ".");
  const parsed = Number(normalized);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  return new Prisma.Decimal(parsed);
}

function parseItemLines(source: string): ParsedItemsResult {
  const lines = source
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const items: ParsedItemLine[] = [];

  for (const line of lines) {
    const [itemCode, description, unit, quantity, unitPrice] = line
      .split("|")
      .map((part) => part.trim());

    if (!itemCode || !description || !unit || !quantity || !unitPrice) {
      return {
        error:
          "Cada item debe venir como codigo|descripcion|unidad|cantidad|precioUnitario.",
      };
    }

    items.push({
      itemCode,
      description,
      unit,
      quantity,
      unitPrice,
    });
  }

  if (items.length === 0) {
    return {
      error: "Ingresa al menos un item para crear el contrato.",
    };
  }

  return { items };
}

function parseClosureLines(source: string): ParsedClosureRowsResult {
  const lines = source
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const rows: ParsedClosureLine[] = [];

  for (const line of lines) {
    const [itemCode, quantityConsumed, discountModeRaw, discountValue, note = ""] =
      line.split("|").map((part) => part.trim());

    if (!itemCode || !quantityConsumed) {
      return {
        error:
          "Cada linea del cierre debe venir como codigo|cantidadMes|modoDescuento|valorDescuento|nota.",
      };
    }

    const discountMode =
      discountModeRaw?.toUpperCase() === DiscountMode.PERCENTAGE
        ? DiscountMode.PERCENTAGE
        : discountModeRaw?.toUpperCase() === DiscountMode.QUANTITY
          ? DiscountMode.QUANTITY
          : DiscountMode.NONE;

    rows.push({
      itemCode,
      quantityConsumed,
      discountMode,
      discountValue: discountValue ?? "",
      note,
    });
  }

  if (rows.length === 0) {
    return {
      error: "Ingresa al menos una linea de cierre.",
    };
  }

  return { rows };
}

export async function createContractFromForm(
  formData: FormData,
): Promise<MutationResult> {
  const code = String(formData.get("code") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const clientName = String(formData.get("clientName") ?? "").trim();
  const currency = String(formData.get("currency") ?? "CLP").trim() || "CLP";
  const statusValue = String(formData.get("status") ?? ContractStatus.DRAFT);
  const description = String(formData.get("description") ?? "").trim();
  const itemsSource = String(formData.get("items") ?? "");

  if (!code || !name || !clientName) {
    return {
      error: "Completa codigo, nombre del contrato y mandante.",
    };
  }

  const parsedItems = parseItemLines(itemsSource);

  if ("error" in parsedItems) {
    return { error: parsedItems.error };
  }

  const itemPayload = [];
  let originalAmount = new Prisma.Decimal(0);

  for (const item of parsedItems.items) {
    const quantity = parseDecimal(item.quantity);
    const unitPrice = parseDecimal(item.unitPrice);

    if (!quantity || !unitPrice) {
      return {
        error: `No pude interpretar cantidad o precio del item ${item.itemCode}.`,
      };
    }

    const itemAmount = quantity.mul(unitPrice);
    originalAmount = originalAmount.add(itemAmount);

    itemPayload.push({
      itemCode: item.itemCode,
      description: item.description,
      unit: item.unit,
      originalQuantity: quantity,
      unitPrice,
      originalAmount: itemAmount,
    });
  }

  const prisma = getPrisma();

  try {
    await prisma.contract.create({
      data: {
        code,
        name,
        clientName,
        description: description || null,
        currency,
        status: Object.values(ContractStatus).includes(statusValue as ContractStatus)
          ? (statusValue as ContractStatus)
          : ContractStatus.DRAFT,
        originalAmount,
        items: {
          create: itemPayload,
        },
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      return {
        error: "Ya existe un contrato con ese codigo.",
      };
    }

    return {
      error: "No pude crear el contrato. Revisa si el codigo ya existe.",
    };
  }

  return {
    success: `Contrato ${code} creado con ${itemPayload.length} items.`,
  };
}

export async function createMonthlyClosureFromForm(
  formData: FormData,
): Promise<MutationResult> {
  const contractId = String(formData.get("contractId") ?? "").trim();
  const year = Number(String(formData.get("year") ?? ""));
  const month = Number(String(formData.get("month") ?? ""));
  const statementNumber = String(formData.get("statementNumber") ?? "").trim();
  const summaryNote = String(formData.get("summaryNote") ?? "").trim();
  const rowsSource = String(formData.get("rows") ?? "");

  if (!contractId || !year || !month) {
    return {
      error: "Selecciona contrato, ano y mes para generar el cierre.",
    };
  }

  const parsedRows = parseClosureLines(rowsSource);

  if ("error" in parsedRows) {
    return { error: parsedRows.error };
  }

  const prisma = getPrisma();
  const contract = await prisma.contract.findUnique({
    where: {
      id: contractId,
    },
    include: {
      items: {
        orderBy: {
          itemCode: "asc",
        },
        include: {
          consumptions: true,
        },
      },
    },
  });

  if (!contract) {
    return {
      error: "No encontre el contrato seleccionado.",
    };
  }

  const itemMap = new Map(contract.items.map((item) => [item.itemCode, item]));
  const consumptionRows: ConsumptionMutationRow[] = [];
  const snapshotRows: ClosureSnapshotMutationRow[] = [];
  let grossAmount = new Prisma.Decimal(0);
  let totalDiscounts = new Prisma.Decimal(0);
  let netAmount = new Prisma.Decimal(0);

  for (const row of parsedRows.rows) {
    const contractItem = itemMap.get(row.itemCode);

    if (!contractItem) {
      return {
        error: `El item ${row.itemCode} no pertenece al contrato seleccionado.`,
      };
    }

    const quantityConsumed = parseDecimal(row.quantityConsumed);

    if (!quantityConsumed) {
      return {
        error: `No pude interpretar la cantidad del item ${row.itemCode}.`,
      };
    }

    const monthGrossAmount = quantityConsumed.mul(contractItem.unitPrice);
    let discountPercent: Prisma.Decimal | null = null;
    let discountQuantity: Prisma.Decimal | null = null;
    let discountAmount = new Prisma.Decimal(0);
    let payableQuantity = quantityConsumed;

    if (row.discountMode === DiscountMode.PERCENTAGE && row.discountValue) {
      discountPercent = parseDecimal(row.discountValue);

      if (!discountPercent) {
        return {
          error: `No pude interpretar el porcentaje de descuento del item ${row.itemCode}.`,
        };
      }

      discountAmount = monthGrossAmount.mul(discountPercent).div(100);
    }

    if (row.discountMode === DiscountMode.QUANTITY && row.discountValue) {
      discountQuantity = parseDecimal(row.discountValue);

      if (!discountQuantity) {
        return {
          error: `No pude interpretar la cantidad descontada del item ${row.itemCode}.`,
        };
      }

      const effectiveDiscountQuantity = discountQuantity.greaterThan(quantityConsumed)
        ? quantityConsumed
        : discountQuantity;

      payableQuantity = quantityConsumed.sub(effectiveDiscountQuantity);
      discountAmount = effectiveDiscountQuantity.mul(contractItem.unitPrice);
    }

    const payableAmount = monthGrossAmount.sub(discountAmount).lessThan(0)
      ? new Prisma.Decimal(0)
      : monthGrossAmount.sub(discountAmount);

    const consumedToDateQuantity = contractItem.consumptions.reduce(
      (accumulator, consumption) => accumulator.add(consumption.quantityConsumed),
      new Prisma.Decimal(0),
    );
    const consumedToDateAmount = contractItem.consumptions.reduce(
      (accumulator, consumption) => accumulator.add(consumption.amountConsumed),
      new Prisma.Decimal(0),
    );

    grossAmount = grossAmount.add(monthGrossAmount);
    totalDiscounts = totalDiscounts.add(discountAmount);
    netAmount = netAmount.add(payableAmount);

    consumptionRows.push({
      contractItemId: contractItem.id,
      year,
      month,
      quantityConsumed,
      amountConsumed: monthGrossAmount,
      discountMode: row.discountMode,
      discountPercent,
      discountQuantity,
      discountAmount,
      payableQuantity,
      payableAmount,
      note: row.note || null,
    });

    snapshotRows.push({
      contractItemId: contractItem.id,
      itemCode: contractItem.itemCode,
      description: contractItem.description,
      unit: contractItem.unit,
      contractQuantity: contractItem.originalQuantity,
      contractAmount: contractItem.originalAmount,
      consumedToDateQuantity: consumedToDateQuantity.add(quantityConsumed),
      consumedToDateAmount: consumedToDateAmount.add(monthGrossAmount),
      monthQuantity: quantityConsumed,
      monthGrossAmount,
      discountMode: row.discountMode,
      discountPercent,
      discountQuantity,
      discountAmount,
      netPayableQuantity: payableQuantity,
      netPayableAmount: payableAmount,
    });
  }

  try {
    await prisma.$transaction(async (tx) => {
      for (const row of consumptionRows) {
        await tx.monthlyConsumption.upsert({
          where: {
            contractItemId_year_month: {
              contractItemId: row.contractItemId,
              year: row.year,
              month: row.month,
            },
          },
          update: {
            quantityConsumed: row.quantityConsumed,
            amountConsumed: row.amountConsumed,
            discountMode: row.discountMode,
            discountPercent: row.discountPercent,
            discountQuantity: row.discountQuantity,
            discountAmount: row.discountAmount,
            payableQuantity: row.payableQuantity,
            payableAmount: row.payableAmount,
            note: row.note,
          },
          create: row,
        });
      }

      await tx.monthlyClosure.deleteMany({
        where: {
          contractId,
          year,
          month,
        },
      });

      await tx.monthlyClosure.create({
        data: {
          contractId,
          year,
          month,
          statementNumber: statementNumber || null,
          summaryNote: summaryNote || null,
          grossAmount,
          totalDiscounts,
          netAmount,
          itemSnapshots: {
            create: snapshotRows,
          },
        },
      });
    });
  } catch (error) {
    console.error(error);
    return {
      error: "No pude guardar el cierre mensual.",
    };
  }

  return {
    success: `Cierre ${String(month).padStart(2, "0")}/${year} generado para ${contract.code}.`,
  };
}
