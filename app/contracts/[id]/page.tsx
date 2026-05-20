import type { Metadata } from "next";
import Link from "next/link";
import { UserRole } from "@prisma/client";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import {
  ContractHeader,
  ContractKpiStrip,
  ContractShell,
  EmptyState,
  StatusBadge,
  TextLinkButton,
} from "@/components/contract-workspace";
import { requireUser } from "@/lib/auth";
import { getContractDetailSnapshot } from "@/lib/contracts";

export const metadata: Metadata = {
  title: "Detalle contrato | Oficina Tecnica",
  description: "Vista consolidada del contrato y sus modulos.",
};

export const dynamic = "force-dynamic";

export default async function ContractDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const contract = await getContractDetailSnapshot(id);

  if (!contract) {
    notFound();
  }

  const contractDuration = formatContractDuration(
    contract.startDateValue,
    contract.endDateValue,
  );
  const latestClosure = contract.closures[0] ?? null;

  return (
    <AppShell
      user={user}
      pathname={`/contracts/${id}`}
      title={`${contract.code} · ${contract.name}`}
      description="Centro operativo para revisar itemizado, estados de pago, NOC y futuras proyecciones del contrato."
    >
      <ContractShell
        contractId={id}
        active="overview"
        userRole={user.role}
        header={
          <ContractHeader
            code={contract.code}
            name={contract.name}
            clientName={contract.clientName}
            status={contract.status}
            meta={
              <>
                <span>{contract.currency}</span>
                <span>{contractDuration}</span>
              </>
            }
          />
        }
        actions={
          <>
            <TextLinkButton href={`/contracts/${id}/items`}>Ver itemizado</TextLinkButton>
            <TextLinkButton href={`/contracts/${id}/closures`} variant="secondary">
              Registrar EDP
            </TextLinkButton>
            <TextLinkButton href={`/contracts/${id}/changes`} variant="secondary">
              Ver NOC
            </TextLinkButton>
            <TextLinkButton href={`/contracts/${id}/forecast`} variant="secondary">
              Forecast
            </TextLinkButton>
            {user.role === UserRole.ADMIN ? (
              <TextLinkButton href={`/contracts/${id}/edit`} variant="secondary">
                Editar
              </TextLinkButton>
            ) : null}
          </>
        }
      >
        <ContractKpiStrip
          items={[
            {
              label: "Monto original",
              value: contract.originalAmount,
              helper: "Monto contractual base",
              tone: "slate",
            },
            {
              label: "NOC aplicadas",
              value: contract.appliedChangeAmount,
              helper: "Variacion contractual",
              tone: "teal",
            },
            {
              label: "Monto vigente",
              value: contract.currentAmount,
              helper: `${contract.itemCount} partidas vigentes`,
              tone: "sky",
            },
            {
              label: "Saldo vigente",
              value: contract.remainingAmount,
              helper: latestClosure
                ? `Ultimo EDP ${latestClosure.periodLabel}`
                : "Sin EDP registrado",
              tone: "amber",
            },
          ]}
        />

        <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <article className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.05)]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-950">Itemizado operativo</h3>
                <p className="mt-1 text-sm text-slate-600">
                  Partidas base con consumido y saldo calculados desde EDP.
                </p>
              </div>
              <TextLinkButton href={`/contracts/${id}/items`} variant="secondary">
                Abrir
              </TextLinkButton>
            </div>
            <div className="mt-4 divide-y divide-slate-100">
              {contract.items.length > 0 ? (
                contract.items.slice(0, 5).map((item: typeof contract.items[number]) => (
                  <div
                    key={item.id}
                    className="grid gap-2 py-3 text-sm md:grid-cols-[minmax(0,1fr)_auto]"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-slate-950">
                        {item.itemNumber} · {item.description}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {item.currentQuantity} {item.unit ?? ""} · {item.currentAmount}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 md:justify-end">
                      <StatusBadge label={`Consumido ${item.consumedAmount}`} tone="teal" />
                      <StatusBadge label={`Saldo ${item.remainingAmount}`} tone="sky" />
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState
                  title="Itemizado pendiente"
                  text="Carga partidas para comenzar a registrar EDP y consumos mensuales."
                  action={
                    <TextLinkButton href={`/contracts/${id}/items`}>
                      Cargar itemizado
                    </TextLinkButton>
                  }
                />
              )}
            </div>
          </article>

          <aside className="grid gap-4">
            <article className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.05)]">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-slate-950">Ultimos EDP</h3>
                <TextLinkButton href={`/contracts/${id}/closures`} variant="secondary">
                  Ver todos
                </TextLinkButton>
              </div>
              <div className="mt-4 space-y-3">
                {contract.closures.length > 0 ? (
                  contract.closures.slice(0, 3).map((closure: typeof contract.closures[number]) => (
                    <Link
                      key={closure.id}
                      href={`/contracts/${id}/closures/${closure.id}`}
                      className="block rounded-[1rem] border border-slate-100 bg-slate-50 px-4 py-3 transition hover:border-slate-300 hover:bg-white"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium text-slate-950">
                          {closure.periodLabel} · {closure.statementNumber}
                        </p>
                        <StatusBadge
                          label={closure.canEdit ? "editable" : "bloqueado"}
                          tone={closure.canEdit ? "teal" : "amber"}
                        />
                      </div>
                      <p className="mt-2 text-sm text-slate-600">Neto {closure.netAmount}</p>
                    </Link>
                  ))
                ) : (
                  <EmptyState
                    title="Sin EDP"
                    text="Cuando registres estados de pago, apareceran aqui."
                  />
                )}
              </div>
            </article>

            <article className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.05)]">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-slate-950">NOC recientes</h3>
                <TextLinkButton href={`/contracts/${id}/changes`} variant="secondary">
                  Ver NOC
                </TextLinkButton>
              </div>
              <div className="mt-4 space-y-3">
                {contract.changes.length > 0 ? (
                  contract.changes.slice(0, 3).map((change: typeof contract.changes[number]) => (
                    <div key={change.id} className="rounded-[1rem] bg-slate-50 px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium text-slate-950">{change.title}</p>
                        <StatusBadge label={change.status} tone="amber" />
                      </div>
                      <p className="mt-1 text-sm text-slate-600">
                        {change.type} · {change.effectiveDate}
                      </p>
                    </div>
                  ))
                ) : (
                  <EmptyState
                    title="Sin NOC"
                    text="Las modificaciones contractuales apareceran aqui cuando se carguen."
                  />
                )}
              </div>
            </article>
          </aside>
        </section>
      </ContractShell>
    </AppShell>
  );
}

function formatContractDuration(startDateValue: string, endDateValue: string) {
  if (!startDateValue || !endDateValue) {
    return "Sin fechas";
  }

  const start = new Date(`${startDateValue}T00:00:00`);
  const end = new Date(`${endDateValue}T00:00:00`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return "Sin fechas";
  }

  if (end < start) {
    return "Fechas invalidas";
  }

  let months =
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth());

  const anchor = new Date(start);
  anchor.setMonth(anchor.getMonth() + months);

  if (anchor > end) {
    months -= 1;
    anchor.setMonth(anchor.getMonth() - 1);
  }

  const millisecondsPerDay = 1000 * 60 * 60 * 24;
  const days = Math.floor((end.getTime() - anchor.getTime()) / millisecondsPerDay);

  if (months <= 0) {
    return `${days + 1} dias`;
  }

  if (days <= 0) {
    return months === 1 ? "1 mes" : `${months} meses`;
  }

  const monthLabel = months === 1 ? "1 mes" : `${months} meses`;
  const dayLabel = days === 1 ? "1 dia" : `${days} dias`;
  return `${monthLabel} y ${dayLabel}`;
}
