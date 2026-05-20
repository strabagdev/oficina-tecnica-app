import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import {
  approveContractForecastFromForm,
  saveContractForecastFromForm,
} from "@/lib/forecast";

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user || user.role !== UserRole.ADMIN) {
    return NextResponse.redirect(
      new URL(
        "/dashboard?type=error&message=No+tienes+permiso+para+administrar+forecast.",
        request.url,
      ),
    );
  }

  const formData = await request.formData();
  const redirectTo = String(formData.get("redirectTo") ?? "/contracts");
  const action = String(formData.get("action") ?? "save").trim();
  const result = action === "approve"
    ? await (async () => {
        const saved = await saveContractForecastFromForm(formData);
        return "error" in saved ? saved : approveContractForecastFromForm(formData);
      })()
    : await saveContractForecastFromForm(formData);
  const params = new URLSearchParams();

  if ("error" in result) {
    params.set("type", "error");
    params.set("message", result.error);
  } else {
    params.set("type", "success");
    params.set("message", result.success);
  }

  return NextResponse.redirect(new URL(`${redirectTo}?${params.toString()}`, request.url));
}
