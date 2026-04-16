import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { createContractFromForm } from "@/lib/mutations";

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user || user.role !== UserRole.ADMIN) {
    return NextResponse.redirect(new URL("/dashboard?type=error&message=No+tienes+permiso+para+crear+contratos.", request.url));
  }

  const formData = await request.formData();
  const redirectTo = String(formData.get("redirectTo") ?? "/contracts/new");
  const result = await createContractFromForm(formData);
  const params = new URLSearchParams();

  if ("error" in result) {
    params.set("type", "error");
    params.set("message", result.error);
  } else {
    params.set("type", "success");
    params.set("message", result.success);
  }

  const successRedirectTo = "error" in result ? redirectTo : result.redirectTo ?? redirectTo;

  return NextResponse.redirect(new URL(`${successRedirectTo}?${params.toString()}`, request.url));
}
