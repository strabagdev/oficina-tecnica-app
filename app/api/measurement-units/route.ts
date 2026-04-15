import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import { buildRedirectUrl } from "@/lib/redirects";

function redirectWithMessage(
  request: Request,
  redirectTo: string,
  type: "success" | "error",
  message: string,
  extraParams?: URLSearchParams,
) {
  const params = new URLSearchParams({
    type,
    message,
  });

  if (extraParams) {
    for (const [key, value] of extraParams.entries()) {
      params.set(key, value);
    }
  }

  return NextResponse.redirect(buildRedirectUrl(request.url, redirectTo, params));
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
  const returnModal = String(formData.get("returnModal") ?? "").trim();
  const baseParams = new URLSearchParams();

  if (returnModal) {
    baseParams.set("modal", returnModal);
  }

  if (action === "create") {
    const code = String(formData.get("code") ?? "").trim();
    const name = String(formData.get("name") ?? "").trim();
    const sortOrder = Number(String(formData.get("sortOrder") ?? "0"));
    const extraParams = new URLSearchParams(baseParams);

    if (!code || !name) {
      extraParams.set("draftUnitCode", code);
      extraParams.set("draftUnitName", name);
      extraParams.set("draftUnitSortOrder", String(Number.isFinite(sortOrder) ? sortOrder : 0));
      return redirectWithMessage(
        request,
        redirectTo,
        "error",
        "Completa+codigo+y+nombre+de+la+unidad.",
        extraParams,
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
      extraParams.set("draftUnitCode", code);
      extraParams.set("draftUnitName", name);
      extraParams.set("draftUnitSortOrder", String(Number.isFinite(sortOrder) ? sortOrder : 0));
      return redirectWithMessage(
        request,
        redirectTo,
        "error",
        "No+se+pudo+crear+la+unidad.+Revisa+si+el+codigo+ya+existe.",
        extraParams,
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
    return redirectWithMessage(request, redirectTo, "error", "Unidad+no+valida.", baseParams);
  }

  if (action === "update") {
    const code = String(formData.get("code") ?? "").trim();
    const name = String(formData.get("name") ?? "").trim();
    const sortOrder = Number(String(formData.get("sortOrder") ?? "0"));
    const extraParams = new URLSearchParams(baseParams);

    extraParams.set("editUnitId", unitId);

    if (!code || !name) {
      extraParams.set("editUnitCode", code);
      extraParams.set("editUnitName", name);
      extraParams.set("editUnitSortOrder", String(Number.isFinite(sortOrder) ? sortOrder : 0));
      return redirectWithMessage(
        request,
        redirectTo,
        "error",
        "Completa+codigo+y+nombre+de+la+unidad.",
        extraParams,
      );
    }

    try {
      await prisma.measurementUnit.update({
        where: {
          id: unitId,
        },
        data: {
          code,
          name,
          sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
        },
      });
    } catch {
      extraParams.set("editUnitCode", code);
      extraParams.set("editUnitName", name);
      extraParams.set("editUnitSortOrder", String(Number.isFinite(sortOrder) ? sortOrder : 0));
      return redirectWithMessage(
        request,
        redirectTo,
        "error",
        "No+se+pudo+actualizar+la+unidad.+Revisa+si+el+codigo+ya+existe.",
        extraParams,
      );
    }

    return redirectWithMessage(
      request,
      redirectTo,
      "success",
      "Unidad+actualizada+correctamente.",
      baseParams,
    );
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
      baseParams,
    );
  }

  return redirectWithMessage(request, redirectTo, "error", "Accion+no+soportada.", baseParams);
}
