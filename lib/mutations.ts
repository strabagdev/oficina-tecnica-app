import "server-only";

import { ContractStatus, DiscountMode, Prisma } from "@prisma/client";
import * as XLSX from "xlsx";
import { getItemTaxonomyOptions } from "@/lib/item-taxonomy";
import { parseDecimalInput } from "@/lib/numeric";
import { getPrisma } from "@/lib/prisma";
import { getMeasurementUnitOptions } from "@/lib/measurement-units";

type ParsedItemLine = {
  family: string;
  subfamily: string;
  itemGroup: string;
  itemNumber: string;
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
  redirectTo?: string;
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
  itemNumber: string;
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

type ContractItemCreateRow = {
  contractId: string;
  family: string | null;
  subfamily: string | null;
  itemGroup: string | null;
  itemNumber: string;
  itemCode: string;
  description: string;
  unit: string | null;
  originalQuantity: Prisma.Decimal;
  unitPrice: Prisma.Decimal;
  originalAmount: Prisma.Decimal;
};

type NormalizedItemInput = {
  family: string | null;
  subfamily: string | null;
  itemGroup: string | null;
  itemNumber: string;
  itemCode: string;
  description: string;
  unit: string | null;
  quantity: Prisma.Decimal;
  unitPrice: Prisma.Decimal;
  originalAmount: Prisma.Decimal;
};

type ResolvedItemTaxonomy = {
  family: string;
  subfamily: string | null;
  itemGroup: string | null;
};

function parseDecimal(value: string) {
  return parseDecimalInput(value);
}

function parseItemLines(source: string): ParsedItemsResult {
  const lines = source
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const items: ParsedItemLine[] = [];

  for (const line of lines) {
    const [family, subfamily, itemGroup, itemNumber, description, unit, quantity, unitPrice] = line
      .split("|")
      .map((part) => part.trim());

    if (!itemNumber || !description || !unit || !quantity || !unitPrice) {
      return {
        error:
          "Cada item debe venir como familia|subfamilia|grupo|numeroItem|descripcion|unidad|cantidad|precioUnitario.",
      };
    }

    items.push({
      family: family ?? "",
      subfamily: subfamily ?? "",
      itemGroup: itemGroup ?? "",
      itemNumber,
      itemCode: itemNumber,
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

function getTextCell(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];

    if (value === null || value === undefined) {
      continue;
    }

    const text = String(value).trim();

    if (text) {
      return text;
    }
  }

  return "";
}

function normalizeItemValues(
  family: string | null,
  subfamily: string | null,
  itemGroup: string | null,
  itemNumber: string,
  description: string,
  unit: string,
  quantity: string,
  unitPrice: string,
): { error: string } | { item: NormalizedItemInput } {
  if (!itemNumber || !description || !quantity || !unitPrice) {
    return {
      error:
        "Completa numero de itemizado, descripcion, cantidad y precio unitario de la partida.",
    };
  }

  const itemCode = itemNumber;

  const quantityValue = parseDecimal(quantity);
  const unitPriceValue = parseDecimal(unitPrice);

  if (!quantityValue || !unitPriceValue) {
    return {
      error: `No pude interpretar cantidad o precio del item ${itemCode}.`,
    };
  }

  return {
    item: {
      family: (family ?? "").trim() || null,
      subfamily: (subfamily ?? "").trim() || null,
      itemGroup: (itemGroup ?? "").trim() || null,
      itemNumber,
      itemCode,
      description,
      unit: unit.trim() || null,
      quantity: quantityValue,
      unitPrice: unitPriceValue,
      originalAmount: quantityValue.mul(unitPriceValue),
    },
  };
}

function buildCreateRow(
  contractId: string,
  item: NormalizedItemInput,
): ContractItemCreateRow {
  return {
    contractId,
    family: item.family,
    subfamily: item.subfamily,
    itemGroup: item.itemGroup,
    itemNumber: item.itemNumber,
    itemCode: item.itemCode,
    description: item.description,
    unit: item.unit,
    originalQuantity: item.quantity,
    unitPrice: item.unitPrice,
    originalAmount: item.originalAmount,
  };
}

async function validateMeasurementUnit(unit: string | null) {
  if (!unit) {
    return "Selecciona una unidad de medida valida para la partida.";
  }

  const units = await getMeasurementUnitOptions();
  const exists = units.some((option: { code: string }) => option.code === unit);

  if (!exists) {
    return `La unidad ${unit} no existe en el catalogo activo.`;
  }

  return null;
}

async function resolveItemTaxonomy(
  formData: FormData,
): Promise<{ error: string } | ResolvedItemTaxonomy> {
  const contractId = String(formData.get("contractId") ?? "").trim();
  const familyId = String(formData.get("familyId") ?? "").trim();
  const subfamilyId = String(formData.get("subfamilyId") ?? "").trim();
  const groupId = String(formData.get("groupId") ?? "").trim();

  if (!familyId) {
    return {
      error: "Selecciona al menos una familia para la partida.",
    };
  }

  const taxonomy = await getItemTaxonomyOptions(contractId || null);
  const family = taxonomy.families.find(
    (item: (typeof taxonomy.families)[number]) => item.id === familyId,
  );

  if (!family) {
    return {
      error: "La jerarquia seleccionada no existe en el catalogo activo.",
    };
  }

  if (!subfamilyId) {
    if (groupId) {
      return {
        error: "No puedes seleccionar un grupo sin antes seleccionar una subfamilia.",
      };
    }

    return {
      family: family.name,
      subfamily: null,
      itemGroup: null,
    };
  }

  const subfamily = taxonomy.subfamilies.find(
    (item: (typeof taxonomy.subfamilies)[number]) => item.id === subfamilyId,
  );

  if (!subfamily) {
    return {
      error: "La subfamilia seleccionada no existe en el catalogo activo.",
    };
  }

  if (subfamily.familyId !== family.id) {
    return {
      error: "La subfamilia seleccionada no pertenece a la familia indicada.",
    };
  }

  if (!groupId) {
    return {
      family: family.name,
      subfamily: subfamily.name,
      itemGroup: null,
    };
  }

  const group = taxonomy.groups.find(
    (item: (typeof taxonomy.groups)[number]) => item.id === groupId,
  );

  if (!group) {
    return {
      error: "El grupo seleccionado no existe en el catalogo activo.",
    };
  }

  if (group.subfamilyId !== subfamily.id) {
    return {
      error: "El grupo seleccionado no pertenece a la subfamilia indicada.",
    };
  }

  return {
    family: family.name,
    subfamily: subfamily.name,
    itemGroup: group.name,
  };
}

async function resolveItemTaxonomyFromLabels(
  contractId: string,
  familyLabel: string,
  subfamilyLabel: string,
  groupLabel: string,
): Promise<{ error: string } | ResolvedItemTaxonomy> {
  if (!familyLabel.trim()) {
    return {
      error: "Cada partida importada debe indicar al menos una familia.",
    };
  }

  const taxonomy = await getItemTaxonomyOptions(contractId);
  const family = taxonomy.families.find(
    (item: (typeof taxonomy.families)[number]) =>
      item.name.toLowerCase() === familyLabel.toLowerCase() ||
      (item.wbs?.toLowerCase() ?? "") === familyLabel.toLowerCase(),
  );

  if (!family) {
    return {
      error: `La familia ${familyLabel} no existe en el catalogo activo.`,
    };
  }

  if (!subfamilyLabel.trim()) {
    if (groupLabel.trim()) {
      return {
        error: `El grupo ${groupLabel} requiere que tambien informes una subfamilia.`,
      };
    }

    return {
      family: family.name,
      subfamily: null,
      itemGroup: null,
    };
  }

  const subfamily = taxonomy.subfamilies.find(
    (item: (typeof taxonomy.subfamilies)[number]) =>
      item.familyId === family.id &&
      (item.name.toLowerCase() === subfamilyLabel.toLowerCase() ||
        (item.wbs?.toLowerCase() ?? "") === subfamilyLabel.toLowerCase()),
  );

  if (!subfamily) {
    return {
      error: `La subfamilia ${subfamilyLabel} no pertenece a la familia ${familyLabel}.`,
    };
  }

  if (!groupLabel.trim()) {
    return {
      family: family.name,
      subfamily: subfamily.name,
      itemGroup: null,
    };
  }

  const group = taxonomy.groups.find(
    (item: (typeof taxonomy.groups)[number]) =>
      item.subfamilyId === subfamily.id &&
      (item.name.toLowerCase() === groupLabel.toLowerCase() ||
        (item.wbs?.toLowerCase() ?? "") === groupLabel.toLowerCase()),
  );

  if (!group) {
    return {
      error: `El grupo ${groupLabel} no pertenece a la subfamilia ${subfamilyLabel}.`,
    };
  }

  return {
    family: family.name,
    subfamily: subfamily.name,
    itemGroup: group.name,
  };
}

async function recalculateContractOriginalAmount(
  tx: Prisma.TransactionClient,
  contractId: string,
) {
  const aggregate = await tx.contractItem.aggregate({
    where: {
      contractId,
    },
    _sum: {
      originalAmount: true,
    },
  });

  await tx.contract.update({
    where: {
      id: contractId,
    },
    data: {
      originalAmount: aggregate._sum.originalAmount ?? new Prisma.Decimal(0),
    },
  });
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

  if (!code || !name || !clientName) {
    return {
      error: "Completa codigo, nombre del contrato y mandante.",
    };
  }

  const prisma = getPrisma();

  try {
    const contract = await prisma.contract.create({
      data: {
        code,
        name,
        clientName,
        description: description || null,
        currency,
        status: Object.values(ContractStatus).includes(statusValue as ContractStatus)
          ? (statusValue as ContractStatus)
          : ContractStatus.DRAFT,
        originalAmount: new Prisma.Decimal(0),
      },
    });

    return {
      success: `Contrato ${code} creado. Ahora define su jerarquia WBS antes de cargar partidas.`,
      redirectTo: `/contracts/${contract.id}/taxonomy`,
    };
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
    success: `Contrato ${code} creado. Ahora define su jerarquia WBS antes de cargar partidas.`,
  };
}

export async function updateContractFromForm(
  contractId: string,
  formData: FormData,
): Promise<MutationResult> {
  const code = String(formData.get("code") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const clientName = String(formData.get("clientName") ?? "").trim();
  const currency = String(formData.get("currency") ?? "CLP").trim() || "CLP";
  const statusValue = String(formData.get("status") ?? ContractStatus.DRAFT);
  const description = String(formData.get("description") ?? "").trim();
  const startDateValue = String(formData.get("startDate") ?? "").trim();
  const endDateValue = String(formData.get("endDate") ?? "").trim();

  if (!contractId || !code || !name || !clientName) {
    return {
      error: "Completa codigo, nombre del contrato y mandante.",
    };
  }

  const startDate = startDateValue ? new Date(startDateValue) : null;
  const endDate = endDateValue ? new Date(endDateValue) : null;

  if (startDate && Number.isNaN(startDate.getTime())) {
    return {
      error: "La fecha de inicio no es valida.",
    };
  }

  if (endDate && Number.isNaN(endDate.getTime())) {
    return {
      error: "La fecha de termino no es valida.",
    };
  }

  const prisma = getPrisma();

  try {
    await prisma.contract.update({
      where: {
        id: contractId,
      },
      data: {
        code,
        name,
        clientName,
        description: description || null,
        currency,
        startDate,
        endDate,
        status: Object.values(ContractStatus).includes(statusValue as ContractStatus)
          ? (statusValue as ContractStatus)
          : ContractStatus.DRAFT,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      return {
        error: "Ya existe otro contrato con ese codigo.",
      };
    }

    return {
      error: "No pude actualizar la cabecera del contrato.",
    };
  }

  return {
    success: `Cabecera del contrato ${code} actualizada.`,
  };
}

export async function createContractItemsFromForm(
  formData: FormData,
): Promise<MutationResult> {
  const contractId = String(formData.get("contractId") ?? "").trim();

  if (!contractId) {
    return {
      error: "Contrato no valido para cargar partidas.",
    };
  }

  const prisma = getPrisma();
  const contract = await prisma.contract.findUnique({
    where: {
      id: contractId,
    },
    select: {
      id: true,
      code: true,
    },
  });

  if (!contract) {
    return {
      error: "No encontre el contrato seleccionado.",
    };
  }

  const itemNumber = String(formData.get("itemNumber") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const unit = String(formData.get("unit") ?? "").trim();
  const quantity = String(formData.get("quantity") ?? "").trim();
  const unitPrice = String(formData.get("unitPrice") ?? "").trim();
  const taxonomy = await resolveItemTaxonomy(formData);

  if ("error" in taxonomy) {
    return taxonomy;
  }
  const normalized = normalizeItemValues(
    taxonomy.family,
    taxonomy.subfamily,
    taxonomy.itemGroup,
    itemNumber,
    description,
    unit,
    quantity,
    unitPrice,
  );

  if ("error" in normalized) {
    return { error: normalized.error };
  }

  const unitValidation = await validateMeasurementUnit(normalized.item.unit);

  if (unitValidation) {
    return { error: unitValidation };
  }

  const itemPayload = buildCreateRow(contractId, normalized.item);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.contractItem.create({
        data: itemPayload,
      });
      await recalculateContractOriginalAmount(tx, contractId);
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      return {
        error: "Hay numeros de itemizado repetidos dentro del contrato.",
      };
    }

    return {
      error: "No pude cargar el itemizado para este contrato.",
    };
  }

  return {
    success: `Se agrego la partida ${normalized.item.itemNumber} en ${contract.code}.`,
  };
}

export async function updateContractItemFromForm(
  itemId: string,
  formData: FormData,
): Promise<MutationResult> {
  const contractId = String(formData.get("contractId") ?? "").trim();
  const itemNumber = String(formData.get("itemNumber") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const unit = String(formData.get("unit") ?? "").trim();
  const quantity = String(formData.get("quantity") ?? "").trim();
  const unitPrice = String(formData.get("unitPrice") ?? "").trim();
  const taxonomy = await resolveItemTaxonomy(formData);

  if ("error" in taxonomy) {
    return taxonomy;
  }

  if (!contractId || !itemId) {
    return {
      error: "Partida no valida para editar.",
    };
  }

  const normalized = normalizeItemValues(
    taxonomy.family,
    taxonomy.subfamily,
    taxonomy.itemGroup,
    itemNumber,
    description,
    unit,
    quantity,
    unitPrice,
  );

  if ("error" in normalized) {
    return { error: normalized.error };
  }

  const unitValidation = await validateMeasurementUnit(normalized.item.unit);

  if (unitValidation) {
    return { error: unitValidation };
  }

  const prisma = getPrisma();

  try {
    await prisma.$transaction(async (tx) => {
      await tx.contractItem.update({
        where: {
          id: itemId,
        },
        data: {
          family: normalized.item.family,
          subfamily: normalized.item.subfamily,
          itemGroup: normalized.item.itemGroup,
          itemNumber: normalized.item.itemNumber,
          itemCode: normalized.item.itemCode,
          description: normalized.item.description,
          unit: normalized.item.unit,
          originalQuantity: normalized.item.quantity,
          unitPrice: normalized.item.unitPrice,
          originalAmount: normalized.item.originalAmount,
        },
      });

      await recalculateContractOriginalAmount(tx, contractId);
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      return {
        error: "Ya existe otra partida con ese numero de itemizado dentro del contrato.",
      };
    }

    return {
      error: "No pude actualizar la partida.",
    };
  }

  return {
    success: `Se actualizo la partida ${normalized.item.itemNumber}.`,
  };
}

export async function importContractItemsFromFile(
  formData: FormData,
): Promise<MutationResult> {
  const contractId = String(formData.get("contractId") ?? "").trim();
  const file = formData.get("file");

  if (!contractId) {
    return {
      error: "Contrato no valido para importar partidas.",
    };
  }

  if (!(file instanceof File) || file.size === 0) {
    return {
      error: "Selecciona un archivo Excel valido para importar.",
    };
  }

  const prisma = getPrisma();
  const contract = await prisma.contract.findUnique({
    where: {
      id: contractId,
    },
    select: {
      id: true,
      code: true,
    },
  });

  if (!contract) {
    return {
      error: "No encontre el contrato seleccionado.",
    };
  }

  let rows: Record<string, unknown>[];

  try {
    const bytes = await file.arrayBuffer();
    const workbook = XLSX.read(Buffer.from(bytes), { type: "buffer" });
    const sheetName = workbook.SheetNames[0];

    if (!sheetName) {
      return {
        error: "El archivo Excel no contiene hojas para importar.",
      };
    }

    rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName], {
      defval: "",
    });
  } catch {
    return {
      error: "No pude leer el archivo Excel seleccionado.",
    };
  }

  if (rows.length === 0) {
    return {
      error: "El archivo Excel no trae filas de partidas.",
    };
  }

  const itemPayload: ContractItemCreateRow[] = [];

  for (const row of rows) {
    const itemNumber = getTextCell(row, [
      "numeroItem",
      "numero_item",
      "numero",
      "Numero",
      "Número",
      "itemNumber",
      "item",
      "Item",
    ]);
    const family = getTextCell(row, ["familia", "Familia", "family"]);
    const subfamily = getTextCell(row, ["subfamilia", "Subfamilia", "subfamily"]);
    const itemGroup = getTextCell(row, ["grupo", "Grupo", "itemGroup", "group"]);
    const description = getTextCell(row, [
      "descripcion",
      "Descripción",
      "DESCRIPCION",
      "description",
      "Descripcion",
    ]);
    const unit = getTextCell(row, ["unidad", "Unidad", "unit", "UM"]);
    const quantity = getTextCell(row, ["cantidad", "Cantidad", "quantity"]);
    const unitPrice = getTextCell(row, [
      "precioUnitario",
      "precio_unitario",
      "PrecioUnitario",
      "precio",
      "Precio",
      "unitPrice",
    ]);

    const taxonomy = await resolveItemTaxonomyFromLabels(
      contractId,
      family,
      subfamily,
      itemGroup,
    );

    if ("error" in taxonomy) {
      return { error: taxonomy.error };
    }

    const normalized = normalizeItemValues(
      taxonomy.family,
      taxonomy.subfamily,
      taxonomy.itemGroup,
      itemNumber,
      description,
      unit,
      quantity,
      unitPrice,
    );

    if ("error" in normalized) {
      return { error: normalized.error };
    }

    const unitValidation = await validateMeasurementUnit(normalized.item.unit);

    if (unitValidation) {
      return { error: unitValidation };
    }

    itemPayload.push(buildCreateRow(contractId, normalized.item));
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.contractItem.createMany({
        data: itemPayload,
      });
      await recalculateContractOriginalAmount(tx, contractId);
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      return {
        error:
          "La importacion contiene numeros de itemizado repetidos o ya existentes en el contrato.",
      };
    }

    return {
      error: "No pude importar el archivo Excel de partidas.",
    };
  }

  return {
    success: `Importacion completada: ${itemPayload.length} partidas cargadas en ${contract.code}.`,
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
          itemNumber: "asc",
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

  const itemMap = new Map(
    contract.items.flatMap((item) => [
      [item.itemNumber, item] as const,
      [item.itemCode, item] as const,
    ]),
  );
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
      itemNumber: contractItem.itemNumber,
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
