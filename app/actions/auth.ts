"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { deleteSession, loginWithPassword } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { getPrisma, prismaSupportsAuthUserId } from "@/lib/prisma";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { USER_APPROVAL_STATUS } from "@/lib/user-approval-status";

export type LoginActionState = {
  error?: string;
};

export type RequestAccessActionState = {
  error?: string;
  success?: string;
};

export async function loginAction(
  _previousState: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return {
      error: "Ingresa correo y contrasena para continuar.",
    };
  }

  const result = await loginWithPassword(email, password);

  if (result.status !== "success") {
    if (result.status === "pending-approval") {
      return {
        error: "Tu solicitud existe, pero aun no ha sido aprobada por un administrador.",
      };
    }

    if (result.status === "rejected") {
      return {
        error: "Tu solicitud fue rechazada. Pide a un administrador que revise tu acceso.",
      };
    }

    if (result.status === "inactive") {
      return {
        error: "Tu cuenta esta inactiva o no esta habilitada para entrar.",
      };
    }

    return {
      error: "Credenciales invalidas o usuario no configurado.",
    };
  }

  redirect("/dashboard");
}

export async function requestAccessAction(
  _previousState: RequestAccessActionState,
  formData: FormData,
): Promise<RequestAccessActionState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!name || !email || !password || !confirmPassword) {
    return {
      error: "Completa nombre, correo y ambas contrasenas para solicitar acceso.",
    };
  }

  if (password !== confirmPassword) {
    return {
      error: "Las contrasenas no coinciden.",
    };
  }

  if (password.length < 8) {
    return {
      error: "La contrasena debe tener al menos 8 caracteres.",
    };
  }

  const prisma = getPrisma();
  const supportsAuthUserId = prismaSupportsAuthUserId();
  const supabase = createSupabaseServiceClient();
  const existingUser = await prisma.user.findUnique({
    where: {
      email,
    },
  });
  const existingApprovalStatus = existingUser
    ? (
        await prisma.$queryRaw<{ approvalStatus: string }[]>`
          select "approvalStatus" from "User" where id = ${existingUser.id}
        `
      )[0]?.approvalStatus
    : null;

  if (existingUser) {
    if (existingApprovalStatus === USER_APPROVAL_STATUS.PENDING) {
      return {
        error: "Ya existe una solicitud pendiente para este correo.",
      };
    }

    if (existingApprovalStatus === USER_APPROVAL_STATUS.REJECTED) {
      return {
        error: "Este correo ya tuvo una solicitud rechazada. Pide revision a un administrador.",
      };
    }

    return {
      error: "Este correo ya existe en el sistema. Intenta ingresar o recupera tu acceso.",
    };
  }

  let createdAuthUserId: string | null = null;

  try {
    const { data: createdAuthUser, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name,
      },
    });

    if (authError || !createdAuthUser.user) {
      return {
        error: "No se pudo crear la cuenta en Supabase. Revisa si el correo ya existe.",
      };
    }

    createdAuthUserId = createdAuthUser.user.id;

    const createdUser = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash: hashPassword(randomUUID()),
        role: UserRole.VIEWER,
        active: true,
        ...(supportsAuthUserId ? { authUserId: createdAuthUserId } : {}),
      },
    });

    await prisma.$executeRaw`
      update "User"
      set "approvalStatus" = ${USER_APPROVAL_STATUS.PENDING}
      where id = ${createdUser.id}
    `;
  } catch {
    if (createdAuthUserId) {
      await supabase.auth.admin.deleteUser(createdAuthUserId).catch(() => undefined);
    }

    return {
      error: "No se pudo registrar la solicitud. Revisa si el correo ya existe.",
    };
  }

  return {
    success: "Solicitud enviada. Un administrador debe aprobar tu acceso antes de ingresar.",
  };
}

export async function logoutAction() {
  await deleteSession();
  redirect("/login");
}
