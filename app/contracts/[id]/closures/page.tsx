import type { Metadata } from "next";
import Link from "next/link";
import { UserRole } from "@prisma/client";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ContractNav } from "@/components/contract-nav";
import { FlashBanner } from "@/components/flash-banner";
import { MonthlyClosureEditorClient } from "@/components/monthly-closure-editor-client";
import { requireUser } from "@/lib/auth";
import { getContractDetailSnapshot, getMonthlyClosureEditSnapshot } from "@/lib/contracts";

export const metadata: Metadata = {
  title: "Cierres del contrato | Oficina Tecnica",
  description: "Historial de cierres y estados de pago de un contrato.",
};

export const dynamic = "force-dynamic";

export default async function ContractClosuresPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const contract = await getContractDetailSnapshot(id);
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const flashType = Array.isArray(resolvedSearchParams?.type)
    ? resolvedSearchParams?.type[0]
    : resolvedSearchParams?.type;
  const flashMessage = Array.isArray(resolvedSearchParams?.message)
    ? resolvedSearchParams?.message[0]
    : resolvedSearchParams?.message;
  const editClosureId = Array.isArray(resolvedSearchParams?.edit)
    ? resolvedSearchParams?.edit[0]
    : resolvedSearchParams?.edit;

  if (!contract) {
    notFound();
  }

  const initialEdit = editClosureId
    ? await getMonthlyClosureEditSnapshot(id, editClosureId)
    : null;

  return (
    <AppShell
      user={user}
      pathname={`/contracts/${id}/closures`}
      title={`Cierres · ${contract.code}`}
      description="Revision de estados de pago y cierres mensuales del contrato."
    >
      <ContractNav contractId={id} active="closures" userRole={user.role} />
      <FlashBanner type={flashType} message={flashMessage} />

      <section className="grid gap-6 xl:grid-cols-[0.72fr_1.28fr]">
        {user.role === UserRole.ADMIN ? (
          <div id="edp-editor" className={initialEdit ? "xl:col-span-2" : ""}>
            <MonthlyClosureEditorClient
              key={initialEdit?.closureId ?? "create-edp"}
              contractId={contract.id}
              contractCode={contract.code}
              currency={contract.currency}
              redirectTo={`/contracts/${id}/closures`}
              initialEdit={initialEdit}
              items={contract.items.map((item) => ({
                id: item.id,
                itemNumber: item.itemNumber,
                itemCode: item.itemCode,
                description: item.description,
                unit: item.unit,
                unitPriceValue: item.unitPriceValue,
                originalQuantityValue: item.currentQuantityValue,
                consumedQuantity: item.consumedQuantity,
                consumedAmount: item.consumedAmount,
              }))}
            />
          </div>
        ) : (
          <article className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-[0_20px_50px_rgba(15,23,42,0.06)]">
            <h2 className="text-2xl font-semibold text-slate-950">Estados de pago</h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              Tu perfil es de visualizacion. Desde aqui puedes revisar el historial mensual y los montos netos aprobados para pago.
            </p>
          </article>
        )}

        <div className="grid gap-5">
        {contract.closures.length > 0 ? (
          contract.closures.map((closure: typeof contract.closures[number]) => (
            <article
              key={closure.id}
              className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_20px_50px_rgba(15,23,42,0.06)]"
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-2xl font-semibold text-slate-950">
                    {closure.periodLabel}
                  </h2>
                  <p className="text-sm leading-7 text-slate-600">
                    Estado de pago {closure.statementNumber}
                  </p>
                  {!closure.canEdit ? (
                    <p className="text-xs text-amber-700">
                      Historico bloqueado: existe un EDP superior.
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <DataPill label="Bruto" value={closure.grossAmount} />
                    <DataPill label="Total descuentos del mes" value={closure.totalDiscounts} />
                    <DataPill label="Neto" value={closure.netAmount} />
                  </div>
                  <div className="flex shrink-0 flex-col gap-2">
                    <Link
                      href={`/contracts/${id}/closures/${closure.id}`}
                      className="rounded-full border border-slate-300 px-4 py-2 text-center text-sm font-medium text-slate-800 transition hover:border-slate-900 hover:text-slate-950"
                    >
                      Ver detalle
                    </Link>
                    <Link
                      href={`/contracts/${id}/closures?edit=${closure.id}&year=${closure.year}&month=${closure.month}#edp-editor`}
                      className={`rounded-full border px-4 py-2 text-center text-sm font-medium transition ${
                        closure.canEdit
                          ? "border-teal-300 text-teal-800 hover:border-teal-700 hover:text-teal-900"
                          : "cursor-not-allowed border-slate-200 text-slate-400 pointer-events-none"
                      }`}
                    >
                      Editar / Reemplazar EDP
                    </Link>
                    <form action="/api/monthly-closures" method="post">
                      <input type="hidden" name="action" value="delete" />
                      <input type="hidden" name="contractId" value={id} />
                      <input type="hidden" name="closureId" value={closure.id} />
                      <input type="hidden" name="redirectTo" value={`/contracts/${id}/closures`} />
                      <button
                        type="submit"
                        disabled={!closure.canDelete}
                        className="w-full rounded-full border border-red-300 px-4 py-2 text-center text-sm font-medium text-red-700 transition hover:border-red-600 hover:text-red-800 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
                      >
                        Eliminar
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            </article>
          ))
        ) : (
          <article className="rounded-[2rem] border border-dashed border-slate-300 bg-white p-8 text-center shadow-[0_20px_50px_rgba(15,23,42,0.04)]">
            <h2 className="text-2xl font-semibold text-slate-950">Sin cierres aun</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Cuando registres estados de pago, apareceran aqui de forma ordenada.
            </p>
          </article>
        )}
        </div>
      </section>
    </AppShell>
  );
}

function DataPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl bg-slate-50 p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <p className="mt-2 text-lg font-semibold text-slate-950">{value}</p>
    </div>
  );
}
