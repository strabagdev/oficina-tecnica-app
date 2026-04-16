import type { Metadata } from "next";
import { UserRole } from "@prisma/client";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ContractNav } from "@/components/contract-nav";
import { FlashBanner } from "@/components/flash-banner";
import { requireUser } from "@/lib/auth";
import { getContractDetailSnapshot } from "@/lib/contracts";

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

  if (!contract) {
    notFound();
  }

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
          <article className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-[0_20px_50px_rgba(15,23,42,0.06)]">
            <h2 className="text-2xl font-semibold text-slate-950">Registrar cierre mensual</h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              Ingresa el estado de pago del mes. Cada linea puede descontar por porcentaje o por cantidad, segun la unidad de la partida.
            </p>

            <form action="/api/monthly-closures" method="post" className="mt-6 space-y-5">
              <input type="hidden" name="contractId" value={contract.id} />
              <input type="hidden" name="redirectTo" value={`/contracts/${id}/closures`} />

              <div className="grid gap-4 md:grid-cols-3">
                <Field label="Ano" name="year" placeholder="2026" />
                <Field label="Mes" name="month" placeholder="3" />
                <Field label="Estado de pago" name="statementNumber" placeholder="EP-03" />
              </div>

              <Field
                label="Resumen"
                name="summaryNote"
                placeholder="Observaciones generales del cierre"
              />

              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700" htmlFor="rows">
                  Lineas del cierre
                </label>
                <textarea
                  id="rows"
                  name="rows"
                  required
                  rows={10}
                  placeholder="1.1|120|QUANTITY|10|Descuento por cubicacion&#10;2.4|850|PERCENTAGE|5|Retencion de calidad"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0f766e] focus:ring-4 focus:ring-[#99f6e4]"
                />
                <p className="text-xs leading-6 text-slate-500">
                  Formato por linea: <code>codigo|cantidadMes|modoDescuento|valorDescuento|nota</code>
                </p>
                <p className="text-xs leading-6 text-slate-500">
                  Modos validos: <code>PERCENTAGE</code>, <code>QUANTITY</code> o vacio si no aplica descuento.
                </p>
              </div>

              <button
                type="submit"
                className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Guardar cierre
              </button>
            </form>
          </article>
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
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-2xl font-semibold text-slate-950">
                    {closure.periodLabel}
                  </h2>
                  <p className="text-sm leading-7 text-slate-600">
                    Estado de pago {closure.statementNumber}
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <DataPill label="Bruto" value={closure.grossAmount} />
                  <DataPill label="Descuentos" value={closure.totalDiscounts} />
                  <DataPill label="Neto" value={closure.netAmount} />
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

function Field(props: {
  label: string;
  name: string;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-700" htmlFor={props.name}>
        {props.label}
      </label>
      <input
        id={props.name}
        name={props.name}
        placeholder={props.placeholder}
        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0f766e] focus:ring-4 focus:ring-[#99f6e4]"
      />
    </div>
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
