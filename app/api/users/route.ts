import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { getPrisma, prismaSupportsAuthUserId } from "@/lib/prisma";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
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

      const createdUser = await prisma.user.create({
        data: {
          name,
          email,
          passwordHash: hashPassword(randomUUID()),
          role: role === UserRole.ADMIN ? UserRole.ADMIN : UserRole.VIEWER,
          active: true,
          ...(supportsAuthUserId && createdAuthUserId ? { authUserId: createdAuthUserId } : {}),
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

    const targetUser = await prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        authUserId: true,
        email: true,
        name: true,
      },
    });

    if (!targetUser) {
      return redirectWithMessage(rerouteRequest, "error", "Usuario+no+encontrado.");
    }

    let authUserId = targetUser.authUserId;

    if (!authUserId) {
      try {
        authUserId = await findSupabaseUserIdByEmail(supabase, targetUser.email);
      } catch {
        return redirectWithMessage(
          rerouteRequest,
          "error",
          "No+se+pudo+consultar+la+cuenta+en+Supabase.",
        );
      }
    }

    if (authUserId) {
      const { error } = await supabase.auth.admin.updateUserById(authUserId, {
        password,
        email_confirm: true,
      });

      if (error) {
        return redirectWithMessage(
          rerouteRequest,
          "error",
          "No+se+pudo+actualizar+la+clave+en+Supabase.",
        );
      }

      if (supportsAuthUserId && targetUser.authUserId !== authUserId) {
        await prisma.user.update({
          where: {
            id: userId,
          },
          data: {
            authUserId,
          },
          select: {
            id: true,
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
        return redirectWithMessage(
          rerouteRequest,
          "error",
          "No+se+pudo+crear+la+cuenta+en+Supabase+para+este+usuario.",
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
          select: {
            id: true,
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
      select: {
        id: true,
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
