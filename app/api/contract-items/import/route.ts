import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { importContractItemsFromFile } from "@/lib/mutations";
import { buildRedirectUrl } from "@/lib/redirects";

export async function POST(request: Request) {
  const wantsJson = request.headers.get("x-import-request") === "1";
  const user = await getCurrentUser();

  if (!user || user.role !== UserRole.ADMIN) {
    const redirectUrl = new URL(
      "/dashboard?type=error&message=No+tienes+permiso+para+importar+partidas.",
      request.url,
    );

    if (wantsJson) {
      return NextResponse.json(
        {
          error: "No tienes permiso para importar partidas.",
          redirectTo: redirectUrl.toString(),
        },
        { status: 403 },
      );
    }

    return NextResponse.redirect(redirectUrl);
  }

  const formData = await request.formData();
  const redirectTo = String(formData.get("redirectTo") ?? "/contracts");
  const returnModal = String(formData.get("returnModal") ?? "").trim();
  const importMode = String(formData.get("importMode") ?? "create").trim();
  const result = await importContractItemsFromFile(formData);
  const params = new URLSearchParams();

  if ("error" in result) {
    params.set("type", "error");
    params.set("message", result.error);
    if (returnModal) {
      params.set("modal", returnModal);
    }
    if (importMode) {
      params.set("importMode", importMode);
    }
  } else {
    params.set("type", "success");
    params.set("message", result.success);
  }

  const redirectUrl = buildRedirectUrl(request.url, redirectTo, params);

  if (wantsJson) {
    return NextResponse.json(
      {
        ok: !("error" in result),
        redirectTo: redirectUrl.toString(),
        message: "error" in result ? result.error : result.success,
      },
      { status: 200 },
    );
  }

  return NextResponse.redirect(redirectUrl);
}
