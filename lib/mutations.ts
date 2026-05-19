import "server-only";

import { ChangeStatus, ChangeType, ContractStatus, DiscountMode, Prisma } from "@prisma/client";
import * as XLSX from "xlsx";
import { getItemTaxonomyOptions } from "@/lib/item-taxonomy";
import { parseDecimalInput } from "@/lib/numeric";
import { getPrisma } from "@/lib/prisma";
import { getMeasurementUnitOptions } from "@/lib/measurement-units";

type ParsedClosureLine = {
  itemCode: string;
  quantityConsumed: string;
  discountMode: DiscountMode;
  discountValue: string;
  note: string;
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
  note: string | null;
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
  currentQuantity: Prisma.Decimal;
  currentAmount: Prisma.Decimal;
};

type ContractItemUpdateRow = {
  id: string;
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
  currentQuantity: Prisma.Decimal;
  currentAmount: Prisma.Decimal;
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

type ContractItemImportMode = "create" | "update";

type ParsedImportRow = {
  rowNumber: number;
  item: NormalizedItemInput;
};

type ValidatedContractItemImport =
  | { error: string }
  | {
      mode: ContractItemImportMode;
      contractCode: string;
      createRows: ContractItemCreateRow[];
      updateRows: ContractItemUpdateRow[];
    };

type ContractItemImportValidationResult =
  | { error: string }
  | {
      success: string;
      mode: ContractItemImportMode;
      contractCode: string;
      itemCount: number;
    };

type ParsedContractChangeLine =
  | {
      createsNewItem: false;
      itemNumber: string;
      quantityDelta: Prisma.Decimal | null;
      amountDelta: Prisma.Decimal;
      description: string;
    }
  | {
      createsNewItem: true;
      itemNumber: string;
      description: string;
      unit: string;
      quantityDelta: Prisma.Decimal;
      unitPrice: Prisma.Decimal;
      amountDelta: Prisma.Decimal;
    };

function parseDecimal(value: string) {
  return parseDecimalInput(value);
}

function parseOptionalDecimal(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  return parseDecimal(trimmed);
}

function resolveChangeType(quantityDelta: Prisma.Decimal, amountDelta: Prisma.Decimal) {
  const hasQuantity = !quantityDelta.isZero();
  const hasAmount = !amountDelta.isZero();

  if (hasQuantity && hasAmount) {
    return ChangeType.MIXED;
  }

  if (hasQuantity) {
    return ChangeType.QUANTITY;
  }

  return ChangeType.AMOUNT;
}

function parseContractChangeLines(source: string): { error: string } | { lines: ParsedContractChangeLine[] } {
  const rawLines = source
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (rawLines.length === 0) {
    return {
      error: "Agrega al menos una linea de impacto para la NOC.",
    };
  }

  const lines: ParsedContractChangeLine[] = [];

  for (const [index, rawLine] of rawLines.entries()) {
    const rowNumber = index + 1;
    const parts = rawLine.split("|").map((part) => part.trim());
    const mode = parts[0]?.toUpperCase();

    if (mode === "EXISTENTE") {
      const [, itemNumber = "", quantityDeltaRaw = "", amountDeltaRaw = "", description = ""] = parts;

      if (!itemNumber) {
        return {
          error: `La linea ${rowNumber} debe indicar numero de item existente.`,
        };
      }

      const quantityDelta = parseOptionalDecimal(quantityDeltaRaw);

      if (quantityDeltaRaw && !quantityDelta) {
        return {
          error: `No pude interpretar la cantidad delta de la linea ${rowNumber}.`,
        };
      }

      const amountDelta = parseOptionalDecimal(amountDeltaRaw);

      if (amountDeltaRaw && !amountDelta) {
        return {
          error: `No pude interpretar el monto delta de la linea ${rowNumber}.`,
        };
      }

      lines.push({
        createsNewItem: false,
        itemNumber,
        quantityDelta,
        amountDelta: amountDelta ?? new Prisma.Decimal(0),
        description,
      });
      continue;
    }

    if (mode === "NUEVO") {
      const [
        ,
        itemNumber = "",
        description = "",
        unit = "",
        quantityRaw = "",
        unitPriceRaw = "",
        amountRaw = "",
      ] = parts;

      if (!itemNumber || !description || !unit || !quantityRaw || !unitPriceRaw) {
        return {
          error:
            `La linea ${rowNumber} debe venir como NUEVO|numero|descripcion|unidad|cantidad|precioUnitario|montoOpcional.`,
        };
      }

      const quantityDelta = parseDecimal(quantityRaw);
      const unitPrice = parseDecimal(unitPriceRaw);

      if (!quantityDelta || !unitPrice) {
        return {
          error: `No pude interpretar cantidad o precio unitario de la linea ${rowNumber}.`,
        };
      }

      if (quantityDelta.lessThanOrEqualTo(0)) {
        return {
          error: `La cantidad de una partida nueva debe ser mayor a cero en la linea ${rowNumber}.`,
        };
      }

      const amountDelta = amountRaw ? parseDecimal(amountRaw) : quantityDelta.mul(unitPrice);

      if (!amountDelta) {
        return {
          error: `No pude interpretar el monto de la linea ${rowNumber}.`,
        };
      }

      if (amountDelta.lessThanOrEqualTo(0)) {
        return {
          error: `El monto de una partida nueva debe ser mayor a cero en la linea ${rowNumber}.`,
        };
      }

      lines.push({
        createsNewItem: true,
        itemNumber,
        description,
        unit,
        quantityDelta,
        unitPrice,
        amountDelta,
      });
      continue;
    }

    return {
      error:
        `La linea ${rowNumber} debe comenzar con EXISTENTE o NUEVO.`,
    };
  }

  return { lines };
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
    currentQuantity: item.quantity,
    currentAmount: item.originalAmount,
  };
}

function buildUpdateRow(
  itemId: string,
  item: NormalizedItemInput,
): ContractItemUpdateRow {
  return {
    id: itemId,
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
    currentQuantity: item.quantity,
    currentAmount: item.originalAmount,
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
  familyWbsLabel = "",
  subfamilyWbsLabel = "",
  groupWbsLabel = "",
): Promise<{ error: string } | ResolvedItemTaxonomy> {
  const normalizedFamilyLabel = familyLabel.trim().toLowerCase();
  const normalizedSubfamilyLabel = subfamilyLabel.trim().toLowerCase();
  const normalizedGroupLabel = groupLabel.trim().toLowerCase();
  const normalizedFamilyWbsLabel = familyWbsLabel.trim().toLowerCase();
  const normalizedSubfamilyWbsLabel = subfamilyWbsLabel.trim().toLowerCase();
  const normalizedGroupWbsLabel = groupWbsLabel.trim().toLowerCase();

  if (!normalizedFamilyLabel && !normalizedFamilyWbsLabel) {
    return {
      error: "Cada partida importada debe indicar al menos una familia o su WBS.",
    };
  }

  const taxonomy = await getItemTaxonomyOptions(contractId);
  const family = taxonomy.families.find(
    (item: (typeof taxonomy.families)[number]) =>
      (normalizedFamilyWbsLabel
        ? (item.wbs?.trim().toLowerCase() ?? "") === normalizedFamilyWbsLabel
        : item.name.toLowerCase() === normalizedFamilyLabel ||
          (item.wbs?.toLowerCase() ?? "") === normalizedFamilyLabel),
  );

  if (!family) {
    return {
      error: `La familia ${familyLabel} no existe en el catalogo activo.`,
    };
  }

  if (!normalizedSubfamilyLabel && !normalizedSubfamilyWbsLabel) {
    if (normalizedGroupLabel || normalizedGroupWbsLabel) {
      return {
        error: `El grupo ${groupLabel || groupWbsLabel} requiere que tambien informes una subfamilia.`,
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
      (normalizedSubfamilyWbsLabel
        ? (item.wbs?.trim().toLowerCase() ?? "") === normalizedSubfamilyWbsLabel
        : item.name.toLowerCase() === normalizedSubfamilyLabel ||
          (item.wbs?.toLowerCase() ?? "") === normalizedSubfamilyLabel),
  );

  if (!subfamily) {
    return {
      error: `La subfamilia ${subfamilyLabel} no pertenece a la familia ${familyLabel}.`,
    };
  }

  if (!normalizedGroupLabel && !normalizedGroupWbsLabel) {
    return {
      family: family.name,
      subfamily: subfamily.name,
      itemGroup: null,
    };
  }

  const group = taxonomy.groups.find(
    (item: (typeof taxonomy.groups)[number]) =>
      item.subfamilyId === subfamily.id &&
      (normalizedGroupWbsLabel
        ? (item.wbs?.trim().toLowerCase() ?? "") === normalizedGroupWbsLabel
        : item.name.toLowerCase() === normalizedGroupLabel ||
          (item.wbs?.toLowerCase() ?? "") === normalizedGroupLabel),
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

function resolveContractItemImportMode(
  value: FormDataEntryValue | null,
): ContractItemImportMode | null {
  const mode = String(value ?? "create").trim().toLowerCase();

  if (mode === "create" || mode === "update") {
    return mode;
  }

  return null;
}

async function validateContractItemsImport(
  formData: FormData,
): Promise<ValidatedContractItemImport> {
  const contractId = String(formData.get("contractId") ?? "").trim();
  const file = formData.get("file");
  const mode = resolveContractItemImportMode(formData.get("importMode"));

  if (!contractId) {
    return {
      error: "Contrato no valido para importar partidas.",
    };
  }

  if (!mode) {
    return {
      error: "Selecciona si la importacion va a crear o actualizar partidas.",
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
      items: {
        select: {
          id: true,
          itemNumber: true,
        },
      },
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

  const parsedRows: ParsedImportRow[] = [];
  const seenItemNumbers = new Set<string>();

  for (const [index, row] of rows.entries()) {
    const rowNumber = index + 2;
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
    const familyWbs = getTextCell(row, ["familiaWbs", "familia_wbs", "familyWbs", "wbsFamilia"]);
    const subfamily = getTextCell(row, ["subfamilia", "Subfamilia", "subfamily"]);
    const subfamilyWbs = getTextCell(row, [
      "subfamiliaWbs",
      "subfamilia_wbs",
      "subfamilyWbs",
      "wbsSubfamilia",
    ]);
    const itemGroup = getTextCell(row, ["grupo", "Grupo", "itemGroup", "group"]);
    const itemGroupWbs = getTextCell(row, [
      "grupoWbs",
      "grupo_wbs",
      "itemGroupWbs",
      "groupWbs",
      "wbsGrupo",
    ]);
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

    if (!itemNumber) {
      return {
        error: `La fila ${rowNumber} no indica numero de itemizado.`,
      };
    }

    if (seenItemNumbers.has(itemNumber)) {
      return {
        error: `La fila ${rowNumber} repite el numero de itemizado ${itemNumber} dentro del archivo.`,
      };
    }

    seenItemNumbers.add(itemNumber);

    const taxonomy = await resolveItemTaxonomyFromLabels(
      contractId,
      family,
      subfamily,
      itemGroup,
      familyWbs,
      subfamilyWbs,
      itemGroupWbs,
    );

    if ("error" in taxonomy) {
      return { error: `Fila ${rowNumber}: ${taxonomy.error}` };
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
      return { error: `Fila ${rowNumber}: ${normalized.error}` };
    }

    const unitValidation = await validateMeasurementUnit(normalized.item.unit);

    if (unitValidation) {
      return { error: `Fila ${rowNumber}: ${unitValidation}` };
    }

    parsedRows.push({
      rowNumber,
      item: normalized.item,
    });
  }

  const existingByItemNumber = new Map(
    contract.items.map((item) => [item.itemNumber, item]),
  );

  if (mode === "create") {
    const conflictingItem = parsedRows.find((row) =>
      existingByItemNumber.has(row.item.itemNumber),
    );

    if (conflictingItem) {
      return {
        error: `La fila ${conflictingItem.rowNumber} usa el item ${conflictingItem.item.itemNumber}, pero ese numero ya existe en ${contract.code}.`,
      };
    }

    return {
      mode,
      contractCode: contract.code,
      createRows: parsedRows.map((row) => buildCreateRow(contractId, row.item)),
      updateRows: [],
    };
  }

  const missingItem = parsedRows.find((row) => !existingByItemNumber.has(row.item.itemNumber));

  if (missingItem) {
    return {
      error: `La fila ${missingItem.rowNumber} intenta actualizar el item ${missingItem.item.itemNumber}, pero ese numero no existe en ${contract.code}.`,
    };
  }

  return {
    mode,
    contractCode: contract.code,
    createRows: [],
    updateRows: parsedRows.map((row) =>
      buildUpdateRow(existingByItemNumber.get(row.item.itemNumber)!.id, row.item),
    ),
  };
}

export async function validateContractItemsImportFromFile(
  formData: FormData,
): Promise<ContractItemImportValidationResult> {
  const validatedImport = await validateContractItemsImport(formData);

  if ("error" in validatedImport) {
    return validatedImport;
  }

  const itemCount =
    validatedImport.mode === "create"
      ? validatedImport.createRows.length
      : validatedImport.updateRows.length;

  return {
    success:
      validatedImport.mode === "create"
        ? `Archivo validado: ${itemCount} partidas listas para cargar en ${validatedImport.contractCode}.`
        : `Archivo validado: ${itemCount} partidas listas para actualizar en ${validatedImport.contractCode}.`,
    mode: validatedImport.mode,
    contractCode: validatedImport.contractCode,
    itemCount,
  };
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
        : discountModeRaw?.toUpperCase() === DiscountMode.AMOUNT
          ? DiscountMode.AMOUNT
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

function parseClosureRowsFromJson(source: string): ParsedClosureRowsResult {
  let parsed: unknown;

  try {
    parsed = JSON.parse(source);
  } catch {
    return {
      error: "El formato de lineas del cierre no es JSON valido.",
    };
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    return {
      error: "Debe haber al menos una partida con cantidad del mes en el cierre.",
    };
  }

  const rows: ParsedClosureLine[] = [];

  for (const entry of parsed) {
    if (!entry || typeof entry !== "object") {
      return {
        error: "Cada linea del cierre debe ser un objeto con codigo y cantidad.",
      };
    }

    const record = entry as Record<string, unknown>;
    const itemCode = String(record.itemCode ?? "").trim();
    const quantityConsumed = String(record.quantityConsumed ?? "").trim();
    const discountModeRaw = String(record.discountMode ?? "").trim();
    const discountValue = String(record.discountValue ?? "").trim();
    const note = String(record.note ?? "").trim();

    if (!itemCode || !quantityConsumed) {
      return {
        error: "Cada linea debe incluir itemCode y quantityConsumed.",
      };
    }

    const discountMode =
      discountModeRaw.toUpperCase() === DiscountMode.PERCENTAGE
        ? DiscountMode.PERCENTAGE
        : discountModeRaw.toUpperCase() === DiscountMode.AMOUNT
          ? DiscountMode.AMOUNT
          : discountModeRaw.toUpperCase() === DiscountMode.QUANTITY
            ? DiscountMode.QUANTITY
          : DiscountMode.NONE;

    rows.push({
      itemCode,
      quantityConsumed,
      discountMode,
      discountValue,
      note,
    });
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
      const existingItem = await tx.contractItem.findUnique({
        where: {
          id: itemId,
        },
        select: {
          originalQuantity: true,
          originalAmount: true,
          currentQuantity: true,
          currentAmount: true,
        },
      });

      if (!existingItem) {
        throw new Error("No encontre la partida a actualizar.");
      }

      const quantityChangeDelta = (existingItem.currentQuantity ?? existingItem.originalQuantity)
        .sub(existingItem.originalQuantity);
      const amountChangeDelta = (existingItem.currentAmount ?? existingItem.originalAmount)
        .sub(existingItem.originalAmount);

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
          currentQuantity: normalized.item.quantity.add(quantityChangeDelta),
          currentAmount: normalized.item.originalAmount.add(amountChangeDelta),
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
  const validatedImport = await validateContractItemsImport(formData);

  if ("error" in validatedImport) {
    return validatedImport;
  }

  const prisma = getPrisma();

  try {
    await prisma.$transaction(async (tx) => {
      if (validatedImport.mode === "create") {
        await tx.contractItem.createMany({
          data: validatedImport.createRows,
        });
      } else {
        for (const row of validatedImport.updateRows) {
          const existingItem = await tx.contractItem.findUnique({
            where: {
              id: row.id,
            },
            select: {
              originalQuantity: true,
              originalAmount: true,
              currentQuantity: true,
              currentAmount: true,
            },
          });

          if (!existingItem) {
            throw new Error("No encontre una partida del archivo para actualizar.");
          }

          const quantityChangeDelta = (existingItem.currentQuantity ?? existingItem.originalQuantity)
            .sub(existingItem.originalQuantity);
          const amountChangeDelta = (existingItem.currentAmount ?? existingItem.originalAmount)
            .sub(existingItem.originalAmount);

          await tx.contractItem.update({
            where: {
              id: row.id,
            },
            data: {
              family: row.family,
              subfamily: row.subfamily,
              itemGroup: row.itemGroup,
              itemNumber: row.itemNumber,
              itemCode: row.itemCode,
              description: row.description,
              unit: row.unit,
              originalQuantity: row.originalQuantity,
              unitPrice: row.unitPrice,
              originalAmount: row.originalAmount,
              currentQuantity: row.originalQuantity.add(quantityChangeDelta),
              currentAmount: row.originalAmount.add(amountChangeDelta),
            },
          });
        }
      }
      await recalculateContractOriginalAmount(tx, contractId);
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      return {
        error:
          validatedImport.mode === "create"
            ? "La importacion contiene numeros de itemizado repetidos o ya existentes en el contrato."
            : "La actualizacion masiva genera un conflicto con numeros de itemizado existentes en el contrato.",
      };
    }

    return {
      error:
        validatedImport.mode === "create"
          ? "No pude importar el archivo Excel de partidas."
          : "No pude actualizar el archivo Excel de partidas.",
    };
  }

  return {
    success:
      validatedImport.mode === "create"
        ? `Importacion completada: ${validatedImport.createRows.length} partidas cargadas en ${validatedImport.contractCode}.`
        : `Actualizacion completada: ${validatedImport.updateRows.length} partidas actualizadas en ${validatedImport.contractCode}.`,
  };
}

export async function createMonthlyClosureFromForm(
  formData: FormData,
): Promise<MutationResult> {
  const contractId = String(formData.get("contractId") ?? "").trim();
  const closureId = String(formData.get("closureId") ?? "").trim();
  const year = Number(String(formData.get("year") ?? ""));
  const month = Number(String(formData.get("month") ?? ""));
  const statementNumber = String(formData.get("statementNumber") ?? "").trim();
  const summaryNote = String(formData.get("summaryNote") ?? "").trim();
  const rowsSource = String(formData.get("rows") ?? "");
  const inputMode = String(formData.get("closureInputMode") ?? "text").trim();
  const rowsJsonRaw = String(formData.get("closureRowsJson") ?? "").trim();
  const useGrid = inputMode === "grid";
  const isReplacement = Boolean(closureId);

  if (!contractId || !year || !month) {
    return {
      error: "Selecciona contrato, ano y mes para generar el cierre.",
    };
  }

  const parsedRows = useGrid
    ? parseClosureRowsFromJson(rowsJsonRaw)
    : parseClosureLines(rowsSource);

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

  const closureToReplace = isReplacement
    ? await prisma.monthlyClosure.findFirst({
        where: {
          id: closureId,
          contractId,
        },
        select: {
          id: true,
          year: true,
          month: true,
        },
      })
    : null;

  if (isReplacement) {
    if (!closureToReplace) {
      return {
        error: "No pude identificar el EDP que intentas reemplazar. Refresca la pagina e intenta nuevamente.",
      };
    }
  }

  const targetClosure = await prisma.monthlyClosure.findFirst({
    where: {
      contractId,
      year,
      month,
    },
    select: {
      id: true,
      year: true,
      month: true,
    },
  });

  if (isReplacement && targetClosure && targetClosure.id !== closureId) {
    return {
      error: "Ya existe otro EDP registrado para el periodo seleccionado.",
    };
  }

  if (isReplacement) {
    const newerThanTargetExists = await prisma.monthlyClosure.findFirst({
      where: {
        contractId,
        id: {
          not: closureId,
        },
        OR: [
          {
            year: {
              gt: year,
            },
          },
          {
            year,
            month: {
              gt: month,
            },
          },
        ],
      },
      select: {
        id: true,
      },
    });

    if (newerThanTargetExists) {
      return {
        error:
          "No puedes mover este EDP a un periodo anterior porque existe un EDP posterior al periodo seleccionado.",
      };
    }
  }

  const referenceClosure = closureToReplace ?? targetClosure;

  if (referenceClosure) {
    const newerClosureExists = await prisma.monthlyClosure.findFirst({
      where: {
        contractId,
        id: {
          not: referenceClosure.id,
        },
        OR: [
          {
            year: {
              gt: referenceClosure.year,
            },
          },
          {
            year: referenceClosure.year,
            month: {
              gt: referenceClosure.month,
            },
          },
        ],
      },
      select: {
        id: true,
      },
    });

    if (newerClosureExists) {
      return {
        error:
          "No puedes reemplazar este EDP porque existe un EDP posterior. El cierre quedo como historico.",
      };
    }
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
  const seenClosureItemIds = new Set<string>();

  for (const row of parsedRows.rows) {
    const contractItem = itemMap.get(row.itemCode);

    if (!contractItem) {
      return {
        error: `El item ${row.itemCode} no pertenece al contrato seleccionado.`,
      };
    }

    if (seenClosureItemIds.has(contractItem.id)) {
      return {
        error: `La partida ${contractItem.itemNumber} (${contractItem.itemCode}) esta repetida en el cierre.`,
      };
    }

    seenClosureItemIds.add(contractItem.id);

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

    if (row.discountMode === DiscountMode.AMOUNT && row.discountValue) {
      const parsedDiscountAmount = parseDecimal(row.discountValue);

      if (!parsedDiscountAmount) {
        return {
          error: `No pude interpretar el monto de descuento del item ${row.itemCode}.`,
        };
      }

      discountAmount = parsedDiscountAmount.greaterThan(monthGrossAmount)
        ? monthGrossAmount
        : parsedDiscountAmount;
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
    const contractQuantity = contractItem.currentQuantity ?? contractItem.originalQuantity;
    const contractAmount = contractItem.currentAmount ?? contractItem.originalAmount;

    const previousConsumptions = contractItem.consumptions.filter((consumption) => {
      const isTargetPeriod = consumption.year === year && consumption.month === month;
      const isOriginalReplacementPeriod =
        closureToReplace &&
        consumption.year === closureToReplace.year &&
        consumption.month === closureToReplace.month;

      return !isTargetPeriod && !isOriginalReplacementPeriod;
    });
    const consumedToDateQuantity = previousConsumptions.reduce(
      (accumulator, consumption) => accumulator.add(consumption.quantityConsumed),
      new Prisma.Decimal(0),
    );
    const consumedToDateAmount = previousConsumptions.reduce(
      (accumulator, consumption) =>
        accumulator.add(consumption.payableAmount ?? consumption.amountConsumed),
      new Prisma.Decimal(0),
    );
    const projectedConsumedQuantity = consumedToDateQuantity.add(quantityConsumed);
    const projectedConsumedAmount = consumedToDateAmount.add(payableAmount);

    if (projectedConsumedQuantity.greaterThan(contractQuantity)) {
      return {
        error: `La partida ${contractItem.itemNumber} supera la cantidad vigente disponible.`,
      };
    }

    if (projectedConsumedAmount.greaterThan(contractAmount)) {
      return {
        error: `La partida ${contractItem.itemNumber} supera el monto vigente disponible.`,
      };
    }

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
      contractQuantity,
      contractAmount,
      consumedToDateQuantity: projectedConsumedQuantity,
      consumedToDateAmount: projectedConsumedAmount,
      monthQuantity: quantityConsumed,
      monthGrossAmount,
      discountMode: row.discountMode,
      discountPercent,
      discountQuantity,
      discountAmount,
      netPayableQuantity: payableQuantity,
      netPayableAmount: payableAmount,
      note: row.note || null,
    });
  }

  try {
    await prisma.$transaction(async (tx) => {
      let resolvedStatementNumber = statementNumber || null;

      if (!resolvedStatementNumber) {
        const existingClosures = await tx.monthlyClosure.findMany({
          where: {
            contractId,
          },
          select: {
            statementNumber: true,
          },
        });

        const highestEdpSequence = existingClosures.reduce((max, closure) => {
          const value = closure.statementNumber?.trim().toUpperCase();

          if (!value) {
            return max;
          }

          const match = /^EDP\s*(\d+)$/.exec(value);

          if (!match) {
            return max;
          }

          const parsed = Number.parseInt(match[1], 10);

          if (!Number.isFinite(parsed)) {
            return max;
          }

          return Math.max(max, parsed);
        }, 0);

        resolvedStatementNumber = `EDP${highestEdpSequence + 1}`;
      }

      if (referenceClosure) {
        const submittedIds = consumptionRows.map((row) => row.contractItemId);

        if (
          closureToReplace &&
          (closureToReplace.year !== year || closureToReplace.month !== month)
        ) {
          await tx.monthlyConsumption.deleteMany({
            where: {
              year: closureToReplace.year,
              month: closureToReplace.month,
              contractItem: {
                contractId,
              },
            },
          });
        }

        await tx.monthlyConsumption.deleteMany({
          where: {
            year,
            month,
            contractItem: {
              contractId,
            },
            ...(submittedIds.length > 0
              ? {
                  contractItemId: {
                    notIn: submittedIds,
                  },
                }
              : {}),
          },
        });
      }

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

      if (closureToReplace) {
        await tx.monthlyClosure.delete({
          where: {
            id: closureToReplace.id,
          },
        });
      } else {
        await tx.monthlyClosure.deleteMany({
          where: {
            contractId,
            year,
            month,
          },
        });
      }

      await tx.monthlyClosure.create({
        data: {
          contractId,
          year,
          month,
          statementNumber: resolvedStatementNumber,
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

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return {
          error: "No pude guardar el cierre mensual porque ya existe un registro para ese periodo.",
        };
      }

      if (error.code === "P2003") {
        return {
          error: "No pude guardar el cierre mensual por una referencia invalida de partida. Refresca la pagina e intenta nuevamente.",
        };
      }

      if (error.code === "P2020") {
        return {
          error: "No pude guardar el cierre mensual porque uno o mas montos no cumplen el formato permitido.",
        };
      }
    }

    return {
      error: "No pude guardar el cierre mensual.",
    };
  }

  return {
    success: `Cierre ${String(month).padStart(2, "0")}/${year} generado para ${contract.code}.`,
  };
}

export async function deleteMonthlyClosureFromForm(
  formData: FormData,
): Promise<MutationResult> {
  const contractId = String(formData.get("contractId") ?? "").trim();
  const closureId = String(formData.get("closureId") ?? "").trim();

  if (!contractId || !closureId) {
    return {
      error: "No pude identificar el cierre a eliminar.",
    };
  }

  const prisma = getPrisma();
  const closure = await prisma.monthlyClosure.findFirst({
    where: {
      id: closureId,
      contractId,
    },
    select: {
      id: true,
      year: true,
      month: true,
      contract: {
        select: {
          code: true,
        },
      },
    },
  });

  if (!closure) {
    return {
      error: "No encontre el cierre seleccionado.",
    };
  }

  const newerClosureExists = await prisma.monthlyClosure.findFirst({
    where: {
      contractId,
      OR: [
        {
          year: {
            gt: closure.year,
          },
        },
        {
          year: closure.year,
          month: {
            gt: closure.month,
          },
        },
      ],
    },
    select: {
      id: true,
    },
  });

  if (newerClosureExists) {
    return {
      error:
        "No puedes eliminar este cierre porque existe un EDP superior. El cierre quedo como historico.",
    };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.monthlyConsumption.deleteMany({
        where: {
          year: closure.year,
          month: closure.month,
          contractItem: {
            contractId,
          },
        },
      });

      await tx.monthlyClosure.delete({
        where: {
          id: closure.id,
        },
      });
    });
  } catch (error) {
    console.error(error);
    return {
      error: "No pude eliminar el cierre mensual.",
    };
  }

  return {
    success: `Cierre ${String(closure.month).padStart(2, "0")}/${closure.year} eliminado de ${closure.contract.code}.`,
  };
}

export async function createContractChangeFromForm(
  formData: FormData,
): Promise<MutationResult> {
  const contractId = String(formData.get("contractId") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const effectiveDateRaw = String(formData.get("effectiveDate") ?? "").trim();
  const linesSource = String(formData.get("lines") ?? "").trim();

  if (!contractId || !title || !effectiveDateRaw) {
    return {
      error: "Completa contrato, titulo y fecha efectiva de la NOC.",
    };
  }

  const effectiveDate = new Date(`${effectiveDateRaw}T00:00:00`);

  if (Number.isNaN(effectiveDate.getTime())) {
    return {
      error: "La fecha efectiva de la NOC no es valida.",
    };
  }

  const parsedLines = parseContractChangeLines(linesSource);

  if ("error" in parsedLines) {
    return parsedLines;
  }

  const prisma = getPrisma();
  const contract = await prisma.contract.findUnique({
    where: {
      id: contractId,
    },
    include: {
      items: true,
    },
  });

  if (!contract) {
    return {
      error: "No encontre el contrato seleccionado.",
    };
  }

  const itemsByNumber = new Map(contract.items.map((item) => [item.itemNumber, item]));
  const seenNewItemNumbers = new Set<string>();
  let quantityDeltaTotal = new Prisma.Decimal(0);
  let amountDeltaTotal = new Prisma.Decimal(0);

  const lineRows = [];

  for (const line of parsedLines.lines) {
    quantityDeltaTotal = quantityDeltaTotal.add(line.quantityDelta ?? new Prisma.Decimal(0));
    amountDeltaTotal = amountDeltaTotal.add(line.amountDelta);

    if (line.createsNewItem) {
      if (itemsByNumber.has(line.itemNumber) || seenNewItemNumbers.has(line.itemNumber)) {
        return {
          error: `La partida nueva ${line.itemNumber} ya existe o esta repetida en la NOC.`,
        };
      }

      const unitValidation = await validateMeasurementUnit(line.unit);

      if (unitValidation) {
        return { error: unitValidation };
      }

      seenNewItemNumbers.add(line.itemNumber);
      lineRows.push({
        contractItemId: null,
        createsNewItem: true,
        family: null,
        subfamily: null,
        itemGroup: null,
        itemNumber: line.itemNumber,
        itemCode: line.itemNumber,
        description: line.description,
        unit: line.unit,
        quantityDelta: line.quantityDelta,
        amountDelta: line.amountDelta,
        unitPrice: line.unitPrice,
      });
      continue;
    }

    const item = itemsByNumber.get(line.itemNumber);

    if (!item) {
      return {
        error: `La partida existente ${line.itemNumber} no pertenece al contrato.`,
      };
    }

    const resolvedAmountDelta =
      line.amountDelta.isZero() && line.quantityDelta
        ? line.quantityDelta.mul(item.unitPrice)
        : line.amountDelta;

    if ((line.quantityDelta?.isZero() ?? true) && resolvedAmountDelta.isZero()) {
      return {
        error: `La partida ${line.itemNumber} no tiene impacto de cantidad ni monto.`,
      };
    }

    amountDeltaTotal = amountDeltaTotal.sub(line.amountDelta).add(resolvedAmountDelta);

    lineRows.push({
      contractItemId: item.id,
      createsNewItem: false,
      family: item.family,
      subfamily: item.subfamily,
      itemGroup: item.itemGroup,
      itemNumber: item.itemNumber,
      itemCode: item.itemCode,
      description: line.description || item.description,
      unit: item.unit,
      quantityDelta: line.quantityDelta,
      amountDelta: resolvedAmountDelta,
      unitPrice: item.unitPrice,
    });
  }

  const changeType = resolveChangeType(quantityDeltaTotal, amountDeltaTotal);

  try {
    await prisma.contractChange.create({
      data: {
        contractId,
        title,
        description: description || null,
        type: changeType,
        status: ChangeStatus.PENDING,
        quantityDelta: quantityDeltaTotal,
        amountDelta: amountDeltaTotal,
        effectiveDate,
        contractItemId:
          lineRows.length === 1 && lineRows[0].contractItemId ? lineRows[0].contractItemId : null,
        lines: {
          create: lineRows,
        },
      },
    });
  } catch (error) {
    console.error(error);
    return {
      error: "No pude crear la NOC.",
    };
  }

  return {
    success: `NOC ${title} creada para ${contract.code}.`,
  };
}

export async function updateContractChangeStatusFromForm(
  formData: FormData,
): Promise<MutationResult> {
  const changeId = String(formData.get("changeId") ?? "").trim();
  const action = String(formData.get("action") ?? "").trim();

  if (!changeId) {
    return {
      error: "No pude identificar la NOC.",
    };
  }

  if (action === "approve") {
    return approveContractChange(changeId);
  }

  if (action === "reject") {
    return rejectContractChange(changeId);
  }

  if (action === "apply") {
    return applyContractChange(changeId);
  }

  return {
    error: "Accion de NOC no soportada.",
  };
}

async function approveContractChange(changeId: string): Promise<MutationResult> {
  const prisma = getPrisma();
  const change = await prisma.contractChange.findUnique({
    where: {
      id: changeId,
    },
    select: {
      id: true,
      title: true,
      status: true,
    },
  });

  if (!change) {
    return {
      error: "No encontre la NOC seleccionada.",
    };
  }

  if (change.status !== ChangeStatus.PENDING) {
    return {
      error: "Solo puedes aprobar una NOC pendiente.",
    };
  }

  await prisma.contractChange.update({
    where: {
      id: change.id,
    },
    data: {
      status: ChangeStatus.APPROVED,
      approvedAt: new Date(),
    },
  });

  return {
    success: `NOC ${change.title} aprobada.`,
  };
}

async function rejectContractChange(changeId: string): Promise<MutationResult> {
  const prisma = getPrisma();
  const change = await prisma.contractChange.findUnique({
    where: {
      id: changeId,
    },
    select: {
      id: true,
      title: true,
      status: true,
    },
  });

  if (!change) {
    return {
      error: "No encontre la NOC seleccionada.",
    };
  }

  if (change.status === ChangeStatus.APPLIED) {
    return {
      error: "No puedes rechazar una NOC ya aplicada.",
    };
  }

  await prisma.contractChange.update({
    where: {
      id: change.id,
    },
    data: {
      status: ChangeStatus.REJECTED,
      rejectedAt: new Date(),
    },
  });

  return {
    success: `NOC ${change.title} rechazada.`,
  };
}

async function applyContractChange(changeId: string): Promise<MutationResult> {
  const prisma = getPrisma();
  const change = await prisma.contractChange.findUnique({
    where: {
      id: changeId,
    },
    include: {
      contract: {
        select: {
          code: true,
        },
      },
      lines: true,
    },
  });

  if (!change) {
    return {
      error: "No encontre la NOC seleccionada.",
    };
  }

  if (change.status === ChangeStatus.APPLIED || change.appliedAt) {
    return {
      error: "Esta NOC ya fue aplicada.",
    };
  }

  if (change.status !== ChangeStatus.APPROVED) {
    return {
      error: "Solo puedes aplicar una NOC aprobada.",
    };
  }

  if (change.lines.length === 0) {
    return {
      error: "La NOC no tiene lineas para aplicar.",
    };
  }

  try {
    await prisma.$transaction(async (tx) => {
      for (const line of change.lines) {
        if (line.appliedAt) {
          throw new Error(`La linea ${line.itemNumber} ya fue aplicada.`);
        }

        if (line.createsNewItem) {
          const existing = await tx.contractItem.findUnique({
            where: {
              contractId_itemNumber: {
                contractId: change.contractId,
                itemNumber: line.itemNumber,
              },
            },
          });

          if (existing) {
            throw new Error(`La partida nueva ${line.itemNumber} ya existe.`);
          }

          const quantity = line.quantityDelta ?? new Prisma.Decimal(0);
          const unitPrice = line.unitPrice ?? new Prisma.Decimal(0);

          if (quantity.lessThanOrEqualTo(0) || line.amountDelta.lessThanOrEqualTo(0)) {
            throw new Error(`La partida nueva ${line.itemNumber} debe tener cantidad y monto positivos.`);
          }

          const item = await tx.contractItem.create({
            data: {
              contractId: change.contractId,
              family: line.family,
              subfamily: line.subfamily,
              itemGroup: line.itemGroup,
              itemNumber: line.itemNumber,
              itemCode: line.itemCode,
              description: line.description,
              unit: line.unit,
              originalQuantity: quantity,
              unitPrice,
              originalAmount: line.amountDelta,
              currentQuantity: quantity,
              currentAmount: line.amountDelta,
            },
          });

          await tx.contractChangeLine.update({
            where: {
              id: line.id,
            },
            data: {
              contractItemId: item.id,
              beforeQuantity: new Prisma.Decimal(0),
              beforeAmount: new Prisma.Decimal(0),
              afterQuantity: item.currentQuantity ?? item.originalQuantity,
              afterAmount: item.currentAmount ?? item.originalAmount,
              appliedAt: new Date(),
            },
          });
          continue;
        }

        if (!line.contractItemId) {
          throw new Error(`La linea ${line.itemNumber} no tiene partida asociada.`);
        }

        const item = await tx.contractItem.findUnique({
          where: {
            id: line.contractItemId,
          },
          include: {
            consumptions: true,
          },
        });

        if (!item) {
          throw new Error(`No encontre la partida ${line.itemNumber}.`);
        }

        const consumedQuantity = item.consumptions.reduce(
          (total, consumption) => total.add(consumption.quantityConsumed),
          new Prisma.Decimal(0),
        );
        const consumedAmount = item.consumptions.reduce(
          (total, consumption) =>
            total.add(consumption.payableAmount ?? consumption.amountConsumed),
          new Prisma.Decimal(0),
        );
        const quantityDelta = line.quantityDelta ?? new Prisma.Decimal(0);
        const beforeQuantity = item.currentQuantity ?? item.originalQuantity;
        const beforeAmount = item.currentAmount ?? item.originalAmount;
        const afterQuantity = beforeQuantity.add(quantityDelta);
        const afterAmount = beforeAmount.add(line.amountDelta);

        if (afterQuantity.lessThan(consumedQuantity)) {
          throw new Error(
            `La NOC deja la partida ${item.itemNumber} bajo la cantidad ya consumida.`,
          );
        }

        if (afterAmount.lessThan(consumedAmount)) {
          throw new Error(
            `La NOC deja la partida ${item.itemNumber} bajo el monto ya consumido.`,
          );
        }

        await tx.contractItem.update({
          where: {
            id: item.id,
          },
          data: {
            currentQuantity: afterQuantity,
            currentAmount: afterAmount,
          },
        });

        await tx.contractChangeLine.update({
          where: {
            id: line.id,
          },
          data: {
            beforeQuantity,
            beforeAmount,
            afterQuantity,
            afterAmount,
            appliedAt: new Date(),
          },
        });
      }

      await tx.contractChange.update({
        where: {
          id: change.id,
        },
        data: {
          status: ChangeStatus.APPLIED,
          appliedAt: new Date(),
        },
      });
    });
  } catch (error) {
    console.error(error);
    return {
      error: error instanceof Error ? error.message : "No pude aplicar la NOC.",
    };
  }

  return {
    success: `NOC ${change.title} aplicada en ${change.contract.code}.`,
  };
}
