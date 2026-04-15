import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { updateContractItemFromForm } from "@/lib/mutations";

export async function POST(
  request: Request,
  context: { params: Promise<{ itemId: string }> },
) {
  const user = await getCurrentUser();

  if (!user || user.role !== UserRole.ADMIN) {
    return NextResponse.redirect(new URL("/dashboard?type=error&message=No+tienes+permiso+para+editar+partidas.", request.url));
  }

  const { itemId } = await context.params;
  const formData = await request.formData();
  const redirectTo = String(formData.get("redirectTo") ?? "/contracts");
  const result = await updateContractItemFromForm(itemId, formData);
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
