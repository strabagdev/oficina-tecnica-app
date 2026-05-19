import type { Metadata } from "next";
import Link from "next/link";
import { UserRole } from "@prisma/client";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ContractNav } from "@/components/contract-nav";
import { requireUser } from "@/lib/auth";
import { getMonthlyClosureDetailSnapshot } from "@/lib/contracts";

export const metadata: Metadata = {
  title: "Detalle estado de pago | Oficina Tecnica",
  description: "Lineas del cierre mensual y montos netos por partida.",
};

export const dynamic = "force-dynamic";

export default async function MonthlyClosureDetailPage({
  params,
}: {
  params: Promise<{ id: string; closureId: string }>;
}) {
  const user = await requireUser();
  const { id, closureId } = await params;
  const detail = await getMonthlyClosureDetailSnapshot(id, closureId);

  if (!detail) {
    notFound();
  }

  return (
    <AppShell
      user={user}
      pathname={`/contracts/${id}/closures`}
      title={`EDP ${detail.periodLabel} · ${detail.contractCode}`}
      description={`${detail.contractName}. Revisión del snapshot guardado al cierre.`}
      actions={
        <div className="flex flex-wrap gap-2">
          {user.role === UserRole.ADMIN && detail.canEdit ? (
            <Link
              href={`/contracts/${id}/closures?edit=${closureId}&year=${detail.year}&month=${detail.month}#edp-editor`}
              className="rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-white/90"
            >
              Editar / Reemplazar EDP
            </Link>
          ) : null}
          <Link
            href={`/contracts/${id}/closures`}
            className="rounded-full border border-white/30 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
          >
            Volver a cierres
          </Link>
        </div>
      }
    >
      <ContractNav contractId={id} active="closures" userRole={user.role} />

      <section className="mt-6 space-y-6">
        <article className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-[0_20px_50px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm text-slate-600">
                Estado de pago <span className="font-semibold text-slate-950">{detail.statementNumber}</span>
              </p>
              <p className="mt-1 text-xs text-slate-500">Registrado: {detail.closedAtLabel}</p>
              {detail.summaryNote ? (
                <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-700">{detail.summaryNote}</p>
              ) : null}
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <DataPill label="Bruto" value={detail.grossAmount} />
              <DataPill label="Total descuentos del mes" value={detail.totalDiscounts} />
              <DataPill label="Neto" value={detail.netAmount} />
            </div>
          </div>
        </article>

        <article className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_20px_50px_rgba(15,23,42,0.06)]">
          <div className="border-b border-slate-100 px-7 py-5">
            <h2 className="text-xl font-semibold text-slate-950">Detalle por partida</h2>
            <p className="mt-1 text-sm text-slate-600">
              Valores congelados en el cierre (contrato, acumulados al cierre, mes y neto).
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[64rem] w-full border-collapse text-left text-sm">
              <thead className="bg-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-4 py-3">Item</th>
                  <th className="px-4 py-3">Descripción</th>
                  <th className="px-4 py-3">UM</th>
                  <th className="px-4 py-3 text-right">Cant. contrato</th>
                  <th className="px-4 py-3 text-right">Monto contrato</th>
                  <th className="px-4 py-3 text-right">Acum. cant.</th>
                  <th className="px-4 py-3 text-right">Acum. monto</th>
                  <th className="px-4 py-3 text-right">Mes cant.</th>
                  <th className="px-4 py-3 text-right">Mes bruto</th>
                  <th className="px-4 py-3">Tipo de descuento</th>
                  <th className="px-4 py-3 text-right">Neto cant.</th>
                  <th className="px-4 py-3 text-right">Neto monto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {detail.lines.map((line) => (
                  <tr key={line.id} className="align-top text-slate-900">
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">
                      <span className="font-semibold">{line.itemNumber}</span>
                      <span className="block text-slate-500">{line.itemCode}</span>
                    </td>
                    <td className="max-w-xs px-4 py-3 text-xs leading-snug text-slate-700">
                      {line.description}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">
                      {line.unit ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-xs">{line.contractQuantity}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-xs">{line.contractAmount}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-xs">
                      {line.consumedToDateQuantity}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-xs">
                      {line.consumedToDateAmount}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-xs">{line.monthQuantity}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-xs">{line.monthGrossAmount}</td>
                    <td className="px-4 py-3 text-xs text-slate-700">{line.discountDisplay}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-xs">{line.netPayableQuantity}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-xs font-medium">
                      {line.netPayableAmount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </section>
    </AppShell>
  );
}

function DataPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl bg-slate-50 px-4 py-3">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-950">{value}</p>
    </div>
  );
}
