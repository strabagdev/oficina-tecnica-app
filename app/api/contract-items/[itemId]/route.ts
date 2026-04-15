import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { updateContractItemFromForm } from "@/lib/mutations";
import { buildRedirectUrl } from "@/lib/redirects";

function appendEditDraftParams(
  params: URLSearchParams,
  itemId: string,
  formData: FormData,
) {
  params.set("editItemId", itemId);

  const fields = [
    ["editFamilyId", "familyId"],
    ["editSubfamilyId", "subfamilyId"],
    ["editGroupId", "groupId"],
    ["editItemNumber", "itemNumber"],
    ["editDescription", "description"],
    ["editUnit", "unit"],
    ["editQuantity", "quantity"],
    ["editUnitPrice", "unitPrice"],
  ] as const;

  for (const [queryKey, formKey] of fields) {
    const value = String(formData.get(formKey) ?? "").trim();

    if (value) {
      params.set(queryKey, value);
    }
  }
}

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
  const returnModal = String(formData.get("returnModal") ?? "").trim();

  if ("error" in result) {
    params.set("type", "error");
    params.set("message", result.error);
    appendEditDraftParams(params, itemId, formData);
    if (returnModal) {
      params.set("modal", returnModal);
    }
  } else {
    params.set("type", "success");
    params.set("message", result.success);
  }

  return NextResponse.redirect(buildRedirectUrl(request.url, redirectTo, params));
}
