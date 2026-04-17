import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { getPrisma, prismaSupportsAuthUserId } from "@/lib/prisma";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

function redirectWithMessage(request: Request, type: "success" | "error", message: string) {
  const redirectTarget = new URL(request.url).searchParams.get("redirectTo") ?? "/admin/users";
  const params = new URLSearchParams({
    type,
    message,
  });

  return NextResponse.redirect(new URL(`${redirectTarget}?${params.toString()}`, request.url));
}

export async function POST(request: Request) {
  const currentUser = await getCurrentUser();

  if (!currentUser || currentUser.role !== UserRole.ADMIN) {
    return redirectWithMessage(request, "error", "No+tienes+permiso+para+administrar+usuarios.");
  }

  const prisma = getPrisma();
  const supportsAuthUserId = prismaSupportsAuthUserId();
  const supabase = createSupabaseServiceClient();
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
        return redirectWithMessage(
          rerouteRequest,
          "error",
          "No+se+pudo+crear+el+usuario+en+Supabase.+Revisa+si+el+correo+ya+existe.",
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
      return redirectWithMessage(
        rerouteRequest,
        "error",
        "No+se+pudo+crear+el+usuario+interno.+Revisa+si+el+correo+ya+existe.",
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
    });

    return redirectWithMessage(rerouteRequest, "success", "Rol+actualizado.");
  }

  if (action === "reset-password") {
    const password = String(formData.get("password") ?? "");

    if (!password) {
      return redirectWithMessage(rerouteRequest, "error", "Ingresa+una+nueva+contrasena.");
    }

    const targetUser = await prisma.user.findUnique({
      where: {
        id: userId,
      },
    });

    if (!targetUser) {
      return redirectWithMessage(rerouteRequest, "error", "Usuario+no+encontrado.");
    }

    if (supportsAuthUserId && targetUser.authUserId) {
      const { error } = await supabase.auth.admin.updateUserById(targetUser.authUserId, {
        password,
      });

      if (error) {
        return redirectWithMessage(
          rerouteRequest,
          "error",
          "No+se+pudo+actualizar+la+clave+en+Supabase.",
        );
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
        return redirectWithMessage(
          rerouteRequest,
          "error",
          "No+se+pudo+crear+la+cuenta+en+Supabase+para+este+usuario.",
        );
      }

      await prisma.user.update({
        where: {
          id: userId,
        },
        data: {
          ...(supportsAuthUserId ? { authUserId: createdAuthUser.user.id } : {}),
        },
      });
    }

    await prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        passwordHash: hashPassword(randomUUID()),
      },
    });

    return redirectWithMessage(
      rerouteRequest,
      "success",
      "Contrasena+actualizada+en+Supabase.",
    );
  }

  return redirectWithMessage(rerouteRequest, "error", "Accion+no+soportada.");
}
