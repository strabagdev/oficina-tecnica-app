import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { getPrisma } from "@/lib/prisma";
import {
  isMissingApprovalStatusSchema,
  resolveUserApprovalStatus,
  USER_APPROVAL_STATUS,
} from "@/lib/user-approval-status";

function redirectWithMessage(request: Request, type: "success" | "error", message: string) {
  const redirectTarget = new URL(request.url).searchParams.get("redirectTo") ?? "/admin/users";
  const params = new URLSearchParams({
    type,
    message,
  });

  return NextResponse.redirect(new URL(`${redirectTarget}?${params.toString()}`, request.url), {
    status: 303,
  });
}

export async function POST(request: Request) {
  const currentUser = await getCurrentUser();

  if (!currentUser || currentUser.role !== UserRole.ADMIN) {
    return redirectWithMessage(request, "error", "No+tienes+permiso+para+administrar+usuarios.");
  }

  const prisma = getPrisma();
  const formData = await request.formData();
  const action = String(formData.get("action") ?? "create");
  const redirectTo = String(formData.get("redirectTo") ?? "/admin/users");
  const url = new URL(request.url);
  url.searchParams.set("redirectTo", redirectTo);
  const rerouteRequest = new Request(url, request);

  if (action === "create") {
    const name = String(formData.get("name") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const password = String(formData.get("password") ?? "");
    const role = String(formData.get("role") ?? UserRole.VIEWER);

    if (!name || !email || !password) {
      return redirectWithMessage(rerouteRequest, "error", "Completa+nombre%2C+correo+y+contrasena+del+usuario.");
    }

    try {
      const createdUser = await prisma.user.create({
        data: {
          name,
          email,
          passwordHash: hashPassword(password),
          role: role === UserRole.ADMIN ? UserRole.ADMIN : UserRole.VIEWER,
          active: true,
        },
        select: {
          id: true,
        },
      });

      try {
        await prisma.$executeRaw`
          update "User"
          set "approvalStatus" = ${USER_APPROVAL_STATUS.APPROVED}
          where id = ${createdUser.id}
        `;
      } catch (error) {
        if (!isMissingApprovalStatusSchema(error)) {
          throw error;
        }
      }
    } catch {
      return redirectWithMessage(
        rerouteRequest,
        "error",
        "No+se+pudo+crear+el+usuario.+Revisa+si+el+correo+ya+existe.",
      );
    }

    return redirectWithMessage(rerouteRequest, "success", "Usuario+creado+correctamente.");
  }

  const userId = String(formData.get("userId") ?? "").trim();

  if (!userId) {
    return redirectWithMessage(rerouteRequest, "error", "Usuario+no+valido+para+la+operacion.");
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
      select: {
        id: true,
      },
    });

    return redirectWithMessage(
      rerouteRequest,
      "success",
      active ? "Usuario+activado." : "Usuario+desactivado.",
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
      select: {
        id: true,
      },
    });

    return redirectWithMessage(rerouteRequest, "success", "Rol+actualizado.");
  }

  if (action === "update-approval-status") {
    const approvalStatus = resolveUserApprovalStatus(
      String(formData.get("approvalStatus") ?? USER_APPROVAL_STATUS.PENDING),
    );

    try {
      await prisma.$executeRaw`
        update "User"
        set "approvalStatus" = ${approvalStatus}
        where id = ${userId}
      `;
    } catch (error) {
      if (!isMissingApprovalStatusSchema(error)) {
        throw error;
      }
    }

    return redirectWithMessage(
      rerouteRequest,
      "success",
      "Estado+de+solicitud+actualizado.",
    );
  }

  if (action === "reset-password") {
    const password = String(formData.get("password") ?? "");

    if (!password) {
      return redirectWithMessage(rerouteRequest, "error", "Ingresa+una+nueva+contrasena.");
    }

    await prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        passwordHash: hashPassword(password),
      },
      select: {
        id: true,
      },
    });

    return redirectWithMessage(
      rerouteRequest,
      "success",
      "Contrasena+actualizada.",
    );
  }

  return redirectWithMessage(rerouteRequest, "error", "Accion+no+soportada.");
}
