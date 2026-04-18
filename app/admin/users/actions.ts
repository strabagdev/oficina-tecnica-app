"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { requireAdmin } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { getPrisma, prismaSupportsAuthUserId } from "@/lib/prisma";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

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

async function findSupabaseUserIdByEmail(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  email: string,
) {
  const normalizedEmail = email.trim().toLowerCase();
  let page = 1;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 200,
    });

    if (error) {
      throw error;
    }

    const matchedUser = data.users.find(
      (user) => user.email?.trim().toLowerCase() === normalizedEmail,
    );

    if (matchedUser) {
      return matchedUser.id;
    }

    if (data.users.length < 200) {
      return null;
    }

    page += 1;
  }
}

export async function manageUserAction(formData: FormData) {
  await requireAdmin();

  const prisma = getPrisma();
  const supportsAuthUserId = prismaSupportsAuthUserId();
  const supabase = createSupabaseServiceClient();
  const action = String(formData.get("action") ?? "create");

  if (action === "create") {
    const name = String(formData.get("name") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const password = String(formData.get("password") ?? "");
    const role = String(formData.get("role") ?? UserRole.VIEWER);

    if (!name || !email || !password) {
      redirectWithMessage("error", "Completa nombre, correo y contrasena del usuario.");
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
        redirectWithMessage(
          "error",
          "No se pudo crear el usuario en Supabase. Revisa si el correo ya existe.",
        );
      }

      createdAuthUserId = createdAuthUser.user.id;

      await prisma.user.create({
        data: {
          name,
          email,
          passwordHash: hashPassword(randomUUID()),
          role: role === UserRole.ADMIN ? UserRole.ADMIN : UserRole.VIEWER,
          active: true,
          ...(supportsAuthUserId && createdAuthUserId ? { authUserId: createdAuthUserId } : {}),
        },
      });
    } catch {
      if (createdAuthUserId) {
        await supabase.auth.admin.deleteUser(createdAuthUserId).catch(() => undefined);
      }

      redirectWithMessage(
        "error",
        "No se pudo crear el usuario interno. Revisa si el correo ya existe.",
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
    });

    revalidatePath("/admin/users");
    redirectWithMessage("success", "Rol actualizado.");
  }

  if (action === "reset-password") {
    const password = String(formData.get("password") ?? "");

    if (!password) {
      redirectWithMessage("error", "Ingresa una nueva contrasena.");
    }

    const targetUser = await prisma.user.findUnique({
      where: {
        id: userId,
      },
    });

    if (!targetUser) {
      redirectWithMessage("error", "Usuario no encontrado.");
    }

    let authUserId = targetUser.authUserId;

    if (!authUserId) {
      try {
        authUserId = await findSupabaseUserIdByEmail(supabase, targetUser.email);
      } catch {
        redirectWithMessage("error", "No se pudo consultar la cuenta en Supabase.");
      }
    }

    if (authUserId) {
      const { error } = await supabase.auth.admin.updateUserById(authUserId, {
        password,
        email_confirm: true,
      });

      if (error) {
        redirectWithMessage("error", "No se pudo actualizar la clave en Supabase.");
      }

      if (supportsAuthUserId && targetUser.authUserId !== authUserId) {
        await prisma.user.update({
          where: {
            id: userId,
          },
          data: {
            authUserId,
          },
        });
      }
    } else {
      const { data: createdAuthUser, error } = await supabase.auth.admin.createUser({
        email: targetUser.email,
        password,
        email_confirm: true,
        user_metadata: {
          name: targetUser.name,
        },
      });

      if (error || !createdAuthUser.user) {
        redirectWithMessage(
          "error",
          "No se pudo crear la cuenta en Supabase para este usuario.",
        );
      }

      authUserId = createdAuthUser.user.id;

      if (supportsAuthUserId) {
        await prisma.user.update({
          where: {
            id: userId,
          },
          data: {
            authUserId,
          },
        });
      }
    }

    await prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        passwordHash: hashPassword(randomUUID()),
      },
    });

    revalidatePath("/admin/users");
    redirectWithMessage("success", "Contrasena actualizada en Supabase.");
  }

  redirectWithMessage("error", "Accion no soportada.");
}
