import "server-only";

import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { UserRole } from "@prisma/client";
import { getPrisma, prismaSupportsAuthUserId } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  isMissingApprovalStatusSchema,
  USER_APPROVAL_STATUS,
} from "@/lib/user-approval-status";

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

type SyncedUserResult =
  | { status: "approved"; user: AuthUser }
  | { status: "pending" }
  | { status: "rejected" }
  | { status: "inactive" }
  | { status: "missing-email" };

export type LoginAttemptResult =
  | { status: "success"; user: AuthUser }
  | { status: "invalid-credentials" }
  | { status: "pending-approval" }
  | { status: "rejected" }
  | { status: "inactive" };

const authUserSelect = {
  id: true,
  authUserId: true,
  name: true,
  email: true,
  role: true,
  active: true,
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

async function getUserApprovalStatus(prisma: ReturnType<typeof getPrisma>, userId: string) {
  try {
    const rows = await prisma.$queryRaw<{ approvalStatus: string }[]>`
      select "approvalStatus" from "User" where id = ${userId}
    `;

    return rows[0]?.approvalStatus ?? USER_APPROVAL_STATUS.APPROVED;
  } catch (error) {
    if (isMissingApprovalStatusSchema(error)) {
      return USER_APPROVAL_STATUS.APPROVED;
    }

    throw error;
  }
}

async function updateUserApprovalStatus(
  prisma: ReturnType<typeof getPrisma>,
  userId: string,
  approvalStatus: string,
) {
  try {
    await prisma.$executeRaw`
      update "User" set "approvalStatus" = ${approvalStatus} where id = ${userId}
    `;
  } catch (error) {
    if (!isMissingApprovalStatusSchema(error)) {
      throw error;
    }
  }
}

async function countUsersByApprovalStatus(
  prisma: ReturnType<typeof getPrisma>,
  approvalStatus: string,
) {
  try {
    const rows = await prisma.$queryRaw<{ count: bigint }[]>`
      select count(*)::bigint as count from "User" where "approvalStatus" = ${approvalStatus}::"UserApprovalStatus"
    `;

    return Number(rows[0]?.count ?? 0);
  } catch (error) {
    if (isMissingApprovalStatusSchema(error)) {
      return approvalStatus === USER_APPROVAL_STATUS.APPROVED ? prisma.user.count() : 0;
    }

    throw error;
  }
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
  const [userCount, approvedUsers, pendingUsers] = await Promise.all([
    prisma.user.count(),
    countUsersByApprovalStatus(prisma, USER_APPROVAL_STATUS.APPROVED),
    countUsersByApprovalStatus(prisma, USER_APPROVAL_STATUS.PENDING),
  ]);
  const hasBootstrapAdmin = Boolean(process.env.ADMIN_EMAIL?.trim());

  return {
    userCount,
    approvedUsers,
    pendingUsers,
    hasBootstrapAdmin: hasBootstrapAdmin || userCount > 0,
    bootstrapPending: approvedUsers === 0,
  };
}

async function syncInternalUser(authUser: SupabaseUser): Promise<SyncedUserResult> {
  await ensureBaseUsers();
  const prisma = getPrisma();
  const supportsAuthUserId = prismaSupportsAuthUserId();
  const email = authUser.email?.trim().toLowerCase();

  if (!email) {
    return { status: "missing-email" };
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
    select: authUserSelect,
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
        select: authUserSelect,
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
        select: authUserSelect,
      });
  const approvalStatus = existingUser
    ? await getUserApprovalStatus(prisma, user.id)
    : bootstrapAdminEmail === email
      ? USER_APPROVAL_STATUS.APPROVED
      : USER_APPROVAL_STATUS.PENDING;

  if (!existingUser) {
    await updateUserApprovalStatus(prisma, user.id, approvalStatus);
  }

  if (!user.active) {
    return { status: "inactive" };
  }

  if (approvalStatus === USER_APPROVAL_STATUS.PENDING) {
    return { status: "pending" };
  }

  if (approvalStatus === USER_APPROVAL_STATUS.REJECTED) {
    return { status: "rejected" };
  }

  return {
    status: "approved",
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    } satisfies AuthUser,
  };
}

export async function deleteSession() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
}

export async function loginWithPassword(
  email: string,
  password: string,
): Promise<LoginAttemptResult> {
  const supabase = await createSupabaseServerClient();
  const normalizedEmail = email.toLowerCase();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password,
  });

  if (error || !data.user) {
    return { status: "invalid-credentials" };
  }

  const syncResult = await syncInternalUser(data.user);

  if (syncResult.status !== "approved") {
    await supabase.auth.signOut();

    if (syncResult.status === "pending") {
      return { status: "pending-approval" };
    }

    if (syncResult.status === "rejected") {
      return { status: "rejected" };
    }

    return { status: "inactive" };
  }

  return { status: "success", user: syncResult.user };
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

  const syncResult = await syncInternalUser(user);

  if (syncResult.status !== "approved") {
    await supabase.auth.signOut();
    return null;
  }

  return syncResult.user;
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
