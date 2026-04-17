import "server-only";

import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { UserRole } from "@prisma/client";
import { getPrisma, prismaSupportsAuthUserId } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type AuthSeedUser = {
  email: string;
  name: string;
  role: UserRole;
};

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
};

function getSeedUsers(): AuthSeedUser[] {
  const adminEmail = process.env.ADMIN_EMAIL?.trim();
  const adminName = process.env.ADMIN_NAME?.trim() || "Administrador";

  if (!adminEmail) {
    return [];
  }

  return [
    {
      email: adminEmail,
      name: adminName,
      role: UserRole.ADMIN,
    },
  ];
}

function buildPlaceholderPasswordHash() {
  return hashPassword(randomBytes(32).toString("hex"));
}

function getAuthDisplayName(user: Pick<SupabaseUser, "email" | "user_metadata">) {
  const metadataName =
    typeof user.user_metadata?.name === "string" ? user.user_metadata.name.trim() : "";

  if (metadataName) {
    return metadataName;
  }

  return user.email?.split("@")[0] || "Usuario";
}

export async function ensureBaseUsers() {
  const prisma = getPrisma();
  const count = await prisma.user.count();

  if (count > 0) {
    return;
  }

  const seedUsers = getSeedUsers();

  if (seedUsers.length === 0) {
    return;
  }

  await prisma.user.createMany({
    data: seedUsers.map((user) => ({
      email: user.email.toLowerCase(),
      name: user.name,
      role: user.role,
      passwordHash: buildPlaceholderPasswordHash(),
    })),
  });
}

export async function getLoginSetup() {
  const prisma = getPrisma();
  const userCount = await prisma.user.count();
  const hasBootstrapAdmin = Boolean(process.env.ADMIN_EMAIL?.trim());

  return {
    userCount,
    hasBootstrapAdmin: hasBootstrapAdmin || userCount > 0,
    bootstrapPending: userCount === 0,
  };
}

async function syncInternalUser(authUser: SupabaseUser) {
  await ensureBaseUsers();
  const prisma = getPrisma();
  const supportsAuthUserId = prismaSupportsAuthUserId();
  const email = authUser.email?.trim().toLowerCase();

  if (!email) {
    return null;
  }

  const existingUser = await prisma.user.findFirst({
    where: {
      OR: supportsAuthUserId
        ? [
            { authUserId: authUser.id },
            { email },
          ]
        : [{ email }],
    },
  });

  const displayName = getAuthDisplayName(authUser);
  const bootstrapAdminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();

  const user = existingUser
    ? await prisma.user.update({
        where: {
          id: existingUser.id,
        },
        data: {
          email,
          name: existingUser.name || displayName,
          ...(supportsAuthUserId
            ? { authUserId: existingUser.authUserId ?? authUser.id }
            : {}),
        },
      })
    : await prisma.user.create({
        data: {
          email,
          name: displayName,
          passwordHash: buildPlaceholderPasswordHash(),
          role: bootstrapAdminEmail === email ? UserRole.ADMIN : UserRole.VIEWER,
          active: true,
          ...(supportsAuthUserId ? { authUserId: authUser.id } : {}),
        },
      });

  if (!user.active) {
    return null;
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  } satisfies AuthUser;
}

export async function deleteSession() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
}

export async function loginWithPassword(email: string, password: string) {
  const supabase = await createSupabaseServerClient();
  const normalizedEmail = email.toLowerCase();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password,
  });

  if (error || !data.user) {
    return null;
  }

  const user = await syncInternalUser(data.user);

  if (!user) {
    await supabase.auth.signOut();
    return null;
  }

  return user;
}

export async function getCurrentUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return syncInternalUser(user);
}

export async function requireUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

export async function requireAdmin() {
  const user = await requireUser();

  if (user.role !== UserRole.ADMIN) {
    redirect("/dashboard");
  }

  return user;
}
