import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { importContractItemsFromFile } from "@/lib/mutations";
import { buildRedirectUrl } from "@/lib/redirects";

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user || user.role !== UserRole.ADMIN) {
    return NextResponse.redirect(new URL("/dashboard?type=error&message=No+tienes+permiso+para+importar+partidas.", request.url));
  }

  const formData = await request.formData();
  const redirectTo = String(formData.get("redirectTo") ?? "/contracts");
  const returnModal = String(formData.get("returnModal") ?? "").trim();
  const result = await importContractItemsFromFile(formData);
  const params = new URLSearchParams();

  if ("error" in result) {
    params.set("type", "error");
    params.set("message", result.error);
    if (returnModal) {
      params.set("modal", returnModal);
    }
  } else {
    params.set("type", "success");
    params.set("message", result.success);
  }

  return NextResponse.redirect(buildRedirectUrl(request.url, redirectTo, params));
}
