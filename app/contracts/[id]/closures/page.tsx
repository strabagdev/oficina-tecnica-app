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
  const createEdp = Array.isArray(resolvedSearchParams?.new)
    ? resolvedSearchParams?.new[0]
    : resolvedSearchParams?.new;

  if (!contract) {
    notFound();
  }

  const initialEdit = editClosureId
    ? await getMonthlyClosureEditSnapshot(id, editClosureId)
    : null;
  const latestClosure = contract.closures[0] ?? null;
  const showEditor = user.role === UserRole.ADMIN && (createEdp === "1" || Boolean(initialEdit));

  return (
    <AppShell
      user={user}
      pathname={`/contracts/${id}/closures`}
      title={`Cierres · ${contract.code}`}
      description="Revision de estados de pago y cierres mensuales del contrato."
    >
      <ContractNav contractId={id} active="closures" userRole={user.role} />
      <FlashBanner type={flashType} message={flashMessage} />

      <section className="space-y-6">
        <article className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-950">Historial de Estados de Pago</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Revisa cierres existentes, snapshots y acciones disponibles antes de registrar un nuevo EDP.
              </p>
            </div>
            {user.role === UserRole.ADMIN && !showEditor ? (
              <Link
                href={`/contracts/${id}/closures?new=1#edp-editor`}
                className="inline-flex items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Crear EDP
              </Link>
            ) : null}
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <DataPill label="Ultimo EDP" value={latestClosure?.statementNumber ?? "Sin EDP"} />
            <DataPill label="Neto acumulado" value={contract.consumedAmount} />
            <DataPill label="Cierres" value={String(contract.closureCount)} />
            <DataPill label="Mes reciente" value={latestClosure?.periodLabel ?? "Pendiente"} />
          </div>
        </article>

        {showEditor ? (
          <section id="edp-editor" className="space-y-3">
            <div className="flex flex-col gap-3 rounded-[1.5rem] border border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-950">
                  {initialEdit ? "Reemplazando EDP existente" : "Creando nuevo EDP"}
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  {initialEdit
                    ? "El reemplazo actualiza este cierre mensual; los otros snapshots historicos se mantienen intactos."
                    : "Completa el flujo solo para las partidas con movimiento del mes."}
                </p>
              </div>
              <Link
                href={`/contracts/${id}/closures`}
                className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 transition hover:border-slate-900 hover:text-slate-950"
              >
                Cerrar editor
              </Link>
            </div>

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
                currentQuantityValue: item.currentQuantityValue,
                currentAmountValue: item.currentAmountValue,
                consumedQuantity: item.consumedQuantity,
                consumedQuantityValue: item.consumedQuantityValue,
                consumedAmount: item.consumedAmount,
                consumedAmountValue: item.consumedAmountValue,
                remainingQuantity: item.remainingQuantity,
                remainingQuantityValue: item.remainingQuantityValue,
                remainingAmount: item.remainingAmount,
                remainingAmountValue: item.remainingAmountValue,
              }))}
            />
          </section>
        ) : null}

        {user.role !== UserRole.ADMIN ? (
          <article className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
            <h2 className="text-lg font-semibold text-slate-950">Estados de pago</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Tu perfil es de visualizacion. Desde aqui puedes revisar el historial mensual y los montos netos aprobados para pago.
            </p>
          </article>
        ) : null}

        <div className="grid gap-4">
        {contract.closures.length > 0 ? (
          contract.closures.map((closure: typeof contract.closures[number]) => (
            <article
              key={closure.id}
              className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_16px_40px_rgba(15,23,42,0.05)]"
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-2xl font-semibold text-slate-950">
                    {closure.periodLabel}
                  </h2>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-sm leading-7 text-slate-600">
                    <span>Estado de pago {closure.statementNumber}</span>
                    <span
                      className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                        closure.status === "REPLACED"
                          ? "border-amber-100 bg-amber-50 text-amber-800"
                          : "border-teal-100 bg-teal-50 text-teal-800"
                      }`}
                    >
                      {closure.statusLabel}
                    </span>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
                      v{closure.version}
                    </span>
                  </div>
                  {!closure.canEdit ? (
                    <p className="text-xs text-amber-700">
                      {closure.status === "REPLACED"
                        ? "Version reemplazada conservada como trazabilidad historica."
                        : "Historico bloqueado: existe un EDP superior."}
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
            {user.role === UserRole.ADMIN && !showEditor ? (
              <Link
                href={`/contracts/${id}/closures?new=1#edp-editor`}
                className="mt-5 inline-flex items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Crear primer EDP
              </Link>
            ) : null}
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
