"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { requireAdmin } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { getPrisma } from "@/lib/prisma";
import {
  isMissingApprovalStatusSchema,
  resolveUserApprovalStatus,
  USER_APPROVAL_STATUS,
} from "@/lib/user-approval-status";

function buildRedirectUrl(type: "success" | "error", message: string) {
  const params = new URLSearchParams({
    type,
    message,
  });

  return `/admin/users?${params.toString()}`;
}

function redirectWithMessage(type: "success" | "error", message: string): never {
  redirect(buildRedirectUrl(type, message));
}

export async function manageUserAction(formData: FormData) {
  await requireAdmin();

  const prisma = getPrisma();
  const action = String(formData.get("action") ?? "create");

  if (action === "create") {
    const name = String(formData.get("name") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const password = String(formData.get("password") ?? "");
    const role = String(formData.get("role") ?? UserRole.VIEWER);

    if (!name || !email || !password) {
      redirectWithMessage("error", "Completa nombre, correo y contrasena del usuario.");
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
      redirectWithMessage(
        "error",
        "No se pudo crear el usuario. Revisa si el correo ya existe.",
      );
    }

    revalidatePath("/admin/users");
    redirectWithMessage("success", "Usuario creado correctamente.");
  }

  const userId = String(formData.get("userId") ?? "").trim();

  if (!userId) {
    redirectWithMessage("error", "Usuario no valido para la operacion.");
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

    revalidatePath("/admin/users");
    redirectWithMessage("success", active ? "Usuario activado." : "Usuario desactivado.");
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

    revalidatePath("/admin/users");
    redirectWithMessage("success", "Rol actualizado.");
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

    revalidatePath("/admin/users");
    redirectWithMessage("success", "Estado de solicitud actualizado.");
  }

  if (action === "reset-password") {
    const password = String(formData.get("password") ?? "");

    if (!password) {
      redirectWithMessage("error", "Ingresa una nueva contrasena.");
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

    revalidatePath("/admin/users");
    redirectWithMessage("success", "Contrasena actualizada.");
  }

  redirectWithMessage("error", "Accion no soportada.");
}
