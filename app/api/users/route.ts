import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { getPrisma } from "@/lib/prisma";

function redirectWithMessage(request: Request, type: "success" | "error", message: string) {
  const params = new URLSearchParams({
    type,
    message,
  });

  return NextResponse.redirect(new URL(`/dashboard?${params.toString()}`, request.url));
}

export async function POST(request: Request) {
  const currentUser = await getCurrentUser();

  if (!currentUser || currentUser.role !== UserRole.ADMIN) {
    return redirectWithMessage(request, "error", "No+tienes+permiso+para+administrar+usuarios.");
  }

  const prisma = getPrisma();
  const formData = await request.formData();
  const action = String(formData.get("action") ?? "create");

  if (action === "create") {
    const name = String(formData.get("name") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const password = String(formData.get("password") ?? "");
    const role = String(formData.get("role") ?? UserRole.VIEWER);

    if (!name || !email || !password) {
      return redirectWithMessage(request, "error", "Completa+nombre%2C+correo+y+contrasena+del+usuario.");
    }

    try {
      await prisma.user.create({
        data: {
          name,
          email,
          passwordHash: hashPassword(password),
          role: role === UserRole.ADMIN ? UserRole.ADMIN : UserRole.VIEWER,
          active: true,
        },
      });
    } catch {
      return redirectWithMessage(request, "error", "No+se+pudo+crear+el+usuario.+Revisa+si+el+correo+ya+existe.");
    }

    return redirectWithMessage(request, "success", "Usuario+creado+correctamente.");
  }

  const userId = String(formData.get("userId") ?? "").trim();

  if (!userId) {
    return redirectWithMessage(request, "error", "Usuario+no+valido+para+la+operacion.");
  }

  if (action === "toggle-active") {
    const active = String(formData.get("active") ?? "false") === "true";

    await prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        active,
      },
    });

    if (!active) {
      await prisma.session.deleteMany({
        where: {
          userId,
        },
      });
    }

    return redirectWithMessage(
      request,
      "success",
      active ? "Usuario+activado." : "Usuario+desactivado+y+sesiones+cerradas.",
    );
  }

  if (action === "update-role") {
    const role = String(formData.get("role") ?? UserRole.VIEWER);

    await prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        role: role === UserRole.ADMIN ? UserRole.ADMIN : UserRole.VIEWER,
      },
    });

    return redirectWithMessage(request, "success", "Rol+actualizado.");
  }

  if (action === "reset-password") {
    const password = String(formData.get("password") ?? "");

    if (!password) {
      return redirectWithMessage(request, "error", "Ingresa+una+nueva+contrasena.");
    }

    await prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        passwordHash: hashPassword(password),
      },
    });

    await prisma.session.deleteMany({
      where: {
        userId,
      },
    });

    return redirectWithMessage(
      request,
      "success",
      "Contrasena+actualizada+y+sesiones+cerradas.",
    );
  }

  return redirectWithMessage(request, "error", "Accion+no+soportada.");
}
