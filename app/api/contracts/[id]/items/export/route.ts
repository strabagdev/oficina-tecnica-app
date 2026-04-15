import { UserRole } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import * as XLSX from "xlsx";
import { getCurrentUser } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";

type ContractExportRecord = Prisma.ContractGetPayload<{
  include: {
    items: true;
  };
}>;

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

  const rows = contract.items.map((item: ContractExportRecord["items"][number]) => ({
    familia: item.family ?? "",
    subfamilia: item.subfamily ?? "",
    grupo: item.itemGroup ?? "",
    numeroItem: item.itemNumber,
    descripcion: item.description,
    unidad: item.unit ?? "",
    cantidad: item.originalQuantity.toNumber(),
    precioUnitario: item.unitPrice.toNumber(),
    montoBase: item.originalAmount.toNumber(),
  }));

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
