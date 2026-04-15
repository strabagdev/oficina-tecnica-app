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

function buildInternalTaxonomyCode(wbs: string, name: string) {
  const base = (wbs || name).trim();

  return base
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^A-Za-z0-9._-]/g, "")
    .toUpperCase();
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user || user.role !== UserRole.ADMIN) {
    return redirectWithMessage(
      request,
      "/dashboard",
      "error",
      "No+tienes+permiso+para+administrar+la+jerarquia+del+itemizado.",
    );
  }

  const prisma = getPrisma();
  const formData = await request.formData();
  const action = String(formData.get("action") ?? "");
  const redirectTo = String(formData.get("redirectTo") ?? "/admin/item-taxonomy");

  if (action === "create-family") {
    const name = String(formData.get("name") ?? "").trim();
    const wbs = String(formData.get("wbs") ?? "").trim();
    const code = buildInternalTaxonomyCode(wbs, name);

    if (!name) {
      return redirectWithMessage(request, redirectTo, "error", "Completa+el+nombre+de+la+familia.");
    }

    try {
      await prisma.itemFamily.create({
        data: {
          code,
          name,
          wbs: wbs || null,
          active: true,
        },
      });
    } catch {
      return redirectWithMessage(request, redirectTo, "error", "No+se+pudo+crear+la+familia.+Revisa+si+ya+existe+una+familia+igual.");
    }

    return redirectWithMessage(request, redirectTo, "success", "Familia+creada+correctamente.");
  }

  if (action === "create-subfamily") {
    const familyId = String(formData.get("familyId") ?? "").trim();
    const name = String(formData.get("name") ?? "").trim();
    const wbs = String(formData.get("wbs") ?? "").trim();
    const code = buildInternalTaxonomyCode(wbs, name);

    if (!familyId || !name) {
      return redirectWithMessage(request, redirectTo, "error", "Completa+familia+y+nombre+de+la+subfamilia.");
    }

    try {
      await prisma.itemSubfamily.create({
        data: {
          familyId,
          code,
          name,
          wbs: wbs || null,
          active: true,
        },
      });
    } catch {
      return redirectWithMessage(request, redirectTo, "error", "No+se+pudo+crear+la+subfamilia.+Revisa+si+ya+existe+otra+igual+en+esa+familia.");
    }

    return redirectWithMessage(request, redirectTo, "success", "Subfamilia+creada+correctamente.");
  }

  if (action === "create-group") {
    const subfamilyId = String(formData.get("subfamilyId") ?? "").trim();
    const name = String(formData.get("name") ?? "").trim();
    const wbs = String(formData.get("wbs") ?? "").trim();
    const code = buildInternalTaxonomyCode(wbs, name);

    if (!subfamilyId || !name) {
      return redirectWithMessage(request, redirectTo, "error", "Completa+subfamilia+y+nombre+del+grupo.");
    }

    try {
      await prisma.itemGroupCatalog.create({
        data: {
          subfamilyId,
          code,
          name,
          wbs: wbs || null,
          active: true,
        },
      });
    } catch {
      return redirectWithMessage(request, redirectTo, "error", "No+se+pudo+crear+el+grupo.+Revisa+si+ya+existe+otro+igual+en+esa+subfamilia.");
    }

    return redirectWithMessage(request, redirectTo, "success", "Grupo+creado+correctamente.");
  }

  if (action === "toggle-family") {
    const familyId = String(formData.get("familyId") ?? "").trim();
    const active = String(formData.get("active") ?? "false") === "true";

    await prisma.itemFamily.update({
      where: {
        id: familyId,
      },
      data: {
        active,
      },
    });

    return redirectWithMessage(request, redirectTo, "success", active ? "Familia+activada." : "Familia+desactivada.");
  }

  if (action === "update-family") {
    const familyId = String(formData.get("familyId") ?? "").trim();
    const name = String(formData.get("name") ?? "").trim();
    const wbs = String(formData.get("wbs") ?? "").trim();
    const code = buildInternalTaxonomyCode(wbs, name);

    if (!familyId || !name) {
      return redirectWithMessage(request, redirectTo, "error", "Completa+el+nombre+de+la+familia.");
    }

    try {
      await prisma.itemFamily.update({
        where: {
          id: familyId,
        },
        data: {
          code,
          name,
          wbs: wbs || null,
        },
      });
    } catch {
      return redirectWithMessage(request, redirectTo, "error", "No+se+pudo+actualizar+la+familia.");
    }

    return redirectWithMessage(request, redirectTo, "success", "Familia+actualizada+correctamente.");
  }

  if (action === "toggle-subfamily") {
    const subfamilyId = String(formData.get("subfamilyId") ?? "").trim();
    const active = String(formData.get("active") ?? "false") === "true";

    await prisma.itemSubfamily.update({
      where: {
        id: subfamilyId,
      },
      data: {
        active,
      },
    });

    return redirectWithMessage(request, redirectTo, "success", active ? "Subfamilia+activada." : "Subfamilia+desactivada.");
  }

  if (action === "update-subfamily") {
    const subfamilyId = String(formData.get("subfamilyId") ?? "").trim();
    const name = String(formData.get("name") ?? "").trim();
    const wbs = String(formData.get("wbs") ?? "").trim();
    const code = buildInternalTaxonomyCode(wbs, name);

    if (!subfamilyId || !name) {
      return redirectWithMessage(request, redirectTo, "error", "Completa+el+nombre+de+la+subfamilia.");
    }

    try {
      await prisma.itemSubfamily.update({
        where: {
          id: subfamilyId,
        },
        data: {
          code,
          name,
          wbs: wbs || null,
        },
      });
    } catch {
      return redirectWithMessage(request, redirectTo, "error", "No+se+pudo+actualizar+la+subfamilia.");
    }

    return redirectWithMessage(request, redirectTo, "success", "Subfamilia+actualizada+correctamente.");
  }

  if (action === "toggle-group") {
    const groupId = String(formData.get("groupId") ?? "").trim();
    const active = String(formData.get("active") ?? "false") === "true";

    await prisma.itemGroupCatalog.update({
      where: {
        id: groupId,
      },
      data: {
        active,
      },
    });

    return redirectWithMessage(request, redirectTo, "success", active ? "Grupo+activado." : "Grupo+desactivado.");
  }

  if (action === "update-group") {
    const groupId = String(formData.get("groupId") ?? "").trim();
    const name = String(formData.get("name") ?? "").trim();
    const wbs = String(formData.get("wbs") ?? "").trim();
    const code = buildInternalTaxonomyCode(wbs, name);

    if (!groupId || !name) {
      return redirectWithMessage(request, redirectTo, "error", "Completa+el+nombre+del+grupo.");
    }

    try {
      await prisma.itemGroupCatalog.update({
        where: {
          id: groupId,
        },
        data: {
          code,
          name,
          wbs: wbs || null,
        },
      });
    } catch {
      return redirectWithMessage(request, redirectTo, "error", "No+se+pudo+actualizar+el+grupo.");
    }

    return redirectWithMessage(request, redirectTo, "success", "Grupo+actualizado+correctamente.");
  }

  return redirectWithMessage(request, redirectTo, "error", "Accion+no+soportada.");
}
