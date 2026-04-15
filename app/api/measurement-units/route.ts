import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";

function redirectWithMessage(
  request: Request,
  redirectTo: string,
  type: "success" | "error",
  message: string,
) {
  const params = new URLSearchParams({
    type,
    message,
  });

  return NextResponse.redirect(new URL(`${redirectTo}?${params.toString()}`, request.url));
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user || user.role !== UserRole.ADMIN) {
    return redirectWithMessage(
      request,
      "/dashboard",
      "error",
      "No+tienes+permiso+para+administrar+unidades.",
    );
  }

  const prisma = getPrisma();
  const formData = await request.formData();
  const action = String(formData.get("action") ?? "create");
  const redirectTo = String(formData.get("redirectTo") ?? "/admin/units");

  if (action === "create") {
    const code = String(formData.get("code") ?? "").trim();
    const name = String(formData.get("name") ?? "").trim();
    const sortOrder = Number(String(formData.get("sortOrder") ?? "0"));

    if (!code || !name) {
      return redirectWithMessage(
        request,
        redirectTo,
        "error",
        "Completa+codigo+y+nombre+de+la+unidad.",
      );
    }

    try {
      await prisma.measurementUnit.create({
        data: {
          code,
          name,
          active: true,
          sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
        },
      });
    } catch {
      return redirectWithMessage(
        request,
        redirectTo,
        "error",
        "No+se+pudo+crear+la+unidad.+Revisa+si+el+codigo+ya+existe.",
      );
    }

    return redirectWithMessage(
      request,
      redirectTo,
      "success",
      "Unidad+creada+correctamente.",
    );
  }

  const unitId = String(formData.get("unitId") ?? "").trim();

  if (!unitId) {
    return redirectWithMessage(request, redirectTo, "error", "Unidad+no+valida.");
  }

  if (action === "toggle-active") {
    const active = String(formData.get("active") ?? "false") === "true";

    await prisma.measurementUnit.update({
      where: {
        id: unitId,
      },
      data: {
        active,
      },
    });

    return redirectWithMessage(
      request,
      redirectTo,
      "success",
      active ? "Unidad+activada." : "Unidad+desactivada.",
    );
  }

  return redirectWithMessage(request, redirectTo, "error", "Accion+no+soportada.");
}
