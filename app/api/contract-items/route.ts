import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { createContractItemsFromForm } from "@/lib/mutations";
import { buildRedirectUrl } from "@/lib/redirects";

function appendDraftParams(params: URLSearchParams, formData: FormData) {
  const fields = [
    ["draftFamilyId", "familyId"],
    ["draftSubfamilyId", "subfamilyId"],
    ["draftGroupId", "groupId"],
    ["draftItemNumber", "itemNumber"],
    ["draftDescription", "description"],
    ["draftUnit", "unit"],
    ["draftQuantity", "quantity"],
    ["draftUnitPrice", "unitPrice"],
  ] as const;

  for (const [queryKey, formKey] of fields) {
    const value = String(formData.get(formKey) ?? "").trim();

    if (value) {
      params.set(queryKey, value);
    }
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user || user.role !== UserRole.ADMIN) {
    return NextResponse.redirect(new URL("/dashboard?type=error&message=No+tienes+permiso+para+cargar+partidas.", request.url));
  }

  const formData = await request.formData();
  const redirectTo = String(formData.get("redirectTo") ?? "/contracts");
  const result = await createContractItemsFromForm(formData);
  const params = new URLSearchParams();
  const returnModal = String(formData.get("returnModal") ?? "").trim();

  if ("error" in result) {
    params.set("type", "error");
    params.set("message", result.error);
    appendDraftParams(params, formData);
    if (returnModal) {
      params.set("modal", returnModal);
    }
  } else {
    params.set("type", "success");
    params.set("message", result.success);
  }

  return NextResponse.redirect(buildRedirectUrl(request.url, redirectTo, params));
}
