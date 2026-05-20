import "server-only";

import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { SESSION_COOKIE_NAME } from "@/lib/auth-cookie";
import { getPrisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/password";
import {
  isMissingApprovalStatusSchema,
  USER_APPROVAL_STATUS,
} from "@/lib/user-approval-status";

type AuthSeedUser = {
  email: string;
  name: string;
  role: UserRole;
  passwordHash: string;
};

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
};

export type LoginAttemptResult =
  | { status: "success"; user: AuthUser }
  | { status: "invalid-credentials" }
  | { status: "pending-approval" }
  | { status: "rejected" }
  | { status: "inactive" };

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

const authUserSelect = {
  id: true,
  name: true,
  email: true,
  passwordHash: true,
  role: true,
  active: true,
};

function getSessionExpiresAt() {
  return new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);
}

function buildSessionCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  };
}

function buildPlaceholderPasswordHash() {
  return hashPassword(randomBytes(32).toString("hex"));
}

function getSeedUsers(): AuthSeedUser[] {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const adminName = process.env.ADMIN_NAME?.trim() || "Administrador";
  const adminPassword = process.env.ADMIN_PASSWORD?.trim();

  if (!adminEmail) {
    return [];
  }

  return [
    {
      email: adminEmail,
      name: adminName,
      role: UserRole.ADMIN,
      passwordHash: adminPassword
        ? hashPassword(adminPassword)
        : buildPlaceholderPasswordHash(),
    },
  ];
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

async function ensureBootstrapAdmin(prisma: ReturnType<typeof getPrisma>) {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const adminName = process.env.ADMIN_NAME?.trim() || "Administrador";
  const adminPassword = process.env.ADMIN_PASSWORD?.trim();

  if (!adminEmail || !adminPassword) {
    return;
  }

  const existingAdmin = await prisma.user.findUnique({
    where: {
      email: adminEmail,
    },
    select: {
      id: true,
      passwordHash: true,
      active: true,
      role: true,
    },
  });

  const passwordMatches = existingAdmin
    ? verifyPassword(adminPassword, existingAdmin.passwordHash)
    : false;

  const admin = existingAdmin
    ? await prisma.user.update({
        where: {
          id: existingAdmin.id,
        },
        data: {
          name: adminName,
          role: UserRole.ADMIN,
          active: true,
          ...(!passwordMatches ? { passwordHash: hashPassword(adminPassword) } : {}),
        },
        select: {
          id: true,
        },
      })
    : await prisma.user.create({
        data: {
          email: adminEmail,
          name: adminName,
          role: UserRole.ADMIN,
          passwordHash: hashPassword(adminPassword),
          active: true,
          approvalStatus: USER_APPROVAL_STATUS.APPROVED,
        },
        select: {
          id: true,
        },
      });

  try {
    await prisma.$executeRaw`
      update "User"
      set "approvalStatus" = ${USER_APPROVAL_STATUS.APPROVED}
      where id = ${admin.id}
    `;
  } catch (error) {
    if (!isMissingApprovalStatusSchema(error)) {
      throw error;
    }
  }
}

async function createSession(userId: string) {
  const prisma = getPrisma();
  const token = randomBytes(32).toString("hex");
  const expiresAt = getSessionExpiresAt();

  await prisma.session.create({
    data: {
      token,
      userId,
      expiresAt,
    },
    select: {
      id: true,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, buildSessionCookieOptions(expiresAt));
}

async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function ensureBaseUsers() {
  const prisma = getPrisma();
  await ensureBootstrapAdmin(prisma);

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
      email: user.email,
      name: user.name,
      role: user.role,
      passwordHash: user.passwordHash,
      approvalStatus: USER_APPROVAL_STATUS.APPROVED,
      active: true,
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

export async function deleteSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (token) {
    await getPrisma().session.deleteMany({
      where: {
        token,
      },
    });
  }

  await clearSessionCookie();
}

export async function loginWithPassword(
  email: string,
  password: string,
): Promise<LoginAttemptResult> {
  await ensureBaseUsers();

  const prisma = getPrisma();
  const normalizedEmail = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({
    where: {
      email: normalizedEmail,
    },
    select: authUserSelect,
  });

  if (!user || !verifyPassword(password, user.passwordHash)) {
    return { status: "invalid-credentials" };
  }

  if (!user.active) {
    return { status: "inactive" };
  }

  const approvalStatus = await getUserApprovalStatus(prisma, user.id);

  if (approvalStatus === USER_APPROVAL_STATUS.PENDING) {
    return { status: "pending-approval" };
  }

  if (approvalStatus === USER_APPROVAL_STATUS.REJECTED) {
    return { status: "rejected" };
  }

  await createSession(user.id);

  return {
    status: "success",
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  };
}

export async function getCurrentUser() {
  await ensureBaseUsers();

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  const prisma = getPrisma();
  const session = await prisma.session.findUnique({
    where: {
      token,
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          active: true,
        },
      },
    },
  });

  if (!session || session.expiresAt <= new Date()) {
    await deleteSession();
    return null;
  }

  if (!session.user.active) {
    await deleteSession();
    return null;
  }

  const approvalStatus = await getUserApprovalStatus(prisma, session.user.id);

  if (approvalStatus !== USER_APPROVAL_STATUS.APPROVED) {
    await deleteSession();
    return null;
  }

  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    role: session.user.role,
  } satisfies AuthUser;
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
