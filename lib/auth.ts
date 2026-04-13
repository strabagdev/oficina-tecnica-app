import "server-only";

import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { getPrisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/password";

const SESSION_COOKIE = "ot_session";
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 7;

type AuthSeedUser = {
  email: string;
  password: string;
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
  const adminPassword = process.env.ADMIN_PASSWORD?.trim();
  const adminName = process.env.ADMIN_NAME?.trim() || "Administrador";

  if (!adminEmail || !adminPassword) {
    return [];
  }

  return [
    {
      email: adminEmail,
      password: adminPassword,
      name: adminName,
      role: UserRole.ADMIN,
    },
  ];
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
      passwordHash: hashPassword(user.password),
    })),
  });
}

export async function getLoginSetup() {
  const prisma = getPrisma();
  const userCount = await prisma.user.count();
  const hasBootstrapAdmin =
    Boolean(process.env.ADMIN_EMAIL?.trim()) &&
    Boolean(process.env.ADMIN_PASSWORD?.trim());

  return {
    userCount,
    hasBootstrapAdmin,
    bootstrapPending: userCount === 0,
  };
}

async function createSession(userId: string) {
  const prisma = getPrisma();
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await prisma.session.create({
    data: {
      token,
      userId,
      expiresAt,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function deleteSession() {
  const prisma = getPrisma();
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (token) {
    await prisma.session.deleteMany({
      where: {
        token,
      },
    });
  }

  cookieStore.delete(SESSION_COOKIE);
}

export async function loginWithPassword(email: string, password: string) {
  await ensureBaseUsers();
  const prisma = getPrisma();

  const user = await prisma.user.findUnique({
    where: {
      email: email.toLowerCase(),
    },
  });

  if (!user || !verifyPassword(password, user.passwordHash)) {
    return null;
  }

  if (!user.active) {
    return null;
  }

  await createSession(user.id);

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  } satisfies AuthUser;
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  const prisma = getPrisma();

  const session = await prisma.session.findUnique({
    where: {
      token,
    },
    include: {
      user: true,
    },
  });

  if (!session) {
    cookieStore.delete(SESSION_COOKIE);
    return null;
  }

  if (session.expiresAt < new Date()) {
    await prisma.session.delete({
      where: {
        id: session.id,
      },
    });
    cookieStore.delete(SESSION_COOKIE);
    return null;
  }

  if (!session.user.active) {
    await prisma.session.delete({
      where: {
        id: session.id,
      },
    });
    cookieStore.delete(SESSION_COOKIE);
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
