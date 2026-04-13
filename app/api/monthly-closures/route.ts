import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { createMonthlyClosureFromForm } from "@/lib/mutations";

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user || user.role !== UserRole.ADMIN) {
    return NextResponse.redirect(new URL("/dashboard?type=error&message=No+tienes+permiso+para+registrar+cierres.", request.url));
  }

  const formData = await request.formData();
  const result = await createMonthlyClosureFromForm(formData);
  const params = new URLSearchParams();

  if ("error" in result) {
    params.set("type", "error");
    params.set("message", result.error);
  } else {
    params.set("type", "success");
    params.set("message", result.success);
  }

  return NextResponse.redirect(new URL(`/dashboard?${params.toString()}`, request.url));
}
