import { UserRole } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import * as XLSX from "xlsx";
import { getCurrentUser } from "@/lib/auth";
import { getItemTaxonomyOptions } from "@/lib/item-taxonomy";
import { decimalToFixedString } from "@/lib/numeric";
import { getPrisma } from "@/lib/prisma";

type ContractExportRecord = Prisma.ContractGetPayload<{
  include: {
    items: true;
  };
}>;

type TaxonomyOptions = Awaited<ReturnType<typeof getItemTaxonomyOptions>>;

function resolveItemTaxonomyWbs(
  taxonomy: TaxonomyOptions,
  item: ContractExportRecord["items"][number],
) {
  const familyCandidates = taxonomy.families.filter(
    (family) => family.name === (item.family ?? ""),
  );

  const rankedFamilies = familyCandidates
    .map((family) => {
      const matchingSubfamilies = item.subfamily
        ? taxonomy.subfamilies.filter(
            (subfamily) =>
              subfamily.familyId === family.id && subfamily.name === item.subfamily,
          )
        : [];
      const matchingGroups = item.itemGroup
        ? matchingSubfamilies.flatMap((subfamily) =>
            taxonomy.groups.filter(
              (group) =>
                group.familyId === family.id &&
                group.subfamilyId === subfamily.id &&
                group.name === item.itemGroup,
            ),
          )
        : [];

      return {
        family,
        matchingSubfamilies,
        matchingGroups,
        score:
          (item.subfamily ? (matchingSubfamilies.length > 0 ? 1 : 0) : 0) +
          (item.itemGroup ? (matchingGroups.length > 0 ? 1 : 0) : 0),
      };
    })
    .sort((left, right) => right.score - left.score);

  const selectedFamily = rankedFamilies[0];

  if (!selectedFamily) {
    return {
      familyWbs: "",
      subfamilyWbs: "",
      groupWbs: "",
    };
  }

  const selectedSubfamily = selectedFamily.matchingSubfamilies[0];
  const selectedGroup = selectedFamily.matchingGroups[0];

  return {
    familyWbs: selectedFamily.family.wbs ?? "",
    subfamilyWbs: selectedSubfamily?.wbs ?? "",
    groupWbs: selectedGroup?.wbs ?? "",
  };
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();

  if (!user) {
    return new Response("No autenticado", { status: 401 });
  }

  if (user.role !== UserRole.ADMIN && user.role !== UserRole.VIEWER) {
    return new Response("Sin permiso", { status: 403 });
  }

  const { id } = await context.params;
  const prisma = getPrisma();
  const contract: ContractExportRecord | null = await prisma.contract.findUnique({
    where: {
      id,
    },
    include: {
      items: {
        orderBy: [{ itemNumber: "asc" }],
      },
    },
  });

  if (!contract) {
    return new Response("Contrato no encontrado", { status: 404 });
  }

  const taxonomy = await getItemTaxonomyOptions(contract.id);
  const rows = contract.items.map((item: ContractExportRecord["items"][number]) => {
    const wbs = resolveItemTaxonomyWbs(taxonomy, item);

    return {
      familiaWbs: wbs.familyWbs,
      subfamiliaWbs: wbs.subfamilyWbs,
      grupoWbs: wbs.groupWbs,
      familia: item.family ?? "",
      subfamilia: item.subfamily ?? "",
      grupo: item.itemGroup ?? "",
      numeroItem: item.itemNumber,
      descripcion: item.description,
      unidad: item.unit ?? "",
      cantidad: decimalToFixedString(item.originalQuantity, 3),
      precioUnitario: decimalToFixedString(item.unitPrice, 2),
      montoBase: decimalToFixedString(item.originalAmount, 2),
    };
  });

  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, sheet, "Partidas");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  const safeCode = contract.code.replace(/[^a-zA-Z0-9-_]+/g, "-");

  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${safeCode}-partidas.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
