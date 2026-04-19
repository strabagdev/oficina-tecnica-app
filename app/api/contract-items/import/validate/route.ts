import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { validateContractItemsImportFromFile } from "@/lib/mutations";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user || user.role !== UserRole.ADMIN) {
      return NextResponse.json(
        { error: "No tienes permiso para validar partidas." },
        { status: 403 },
      );
    }

    const formData = await request.formData();
    const result = await validateContractItemsImportFromFile(formData);

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error && error.message.trim()
        ? `No pude validar el archivo Excel: ${error.message}`
        : "No pude validar el archivo Excel por un error inesperado del servidor.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
