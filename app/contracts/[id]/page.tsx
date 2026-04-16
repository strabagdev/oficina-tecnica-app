import type { Metadata } from "next";
import Link from "next/link";
import { UserRole } from "@prisma/client";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ContractNav } from "@/components/contract-nav";
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

  return (
    <AppShell
      user={user}
      pathname={`/contracts/${id}`}
      title={`${contract.code} · ${contract.name}`}
      description="Detalle general del contrato, con acceso a partidas, cierres y cambios contractuales."
      actions={
        <div className="flex flex-wrap gap-2">
          {user.role === UserRole.ADMIN ? (
            <Link
              href={`/contracts/${id}/edit`}
              className="rounded-full bg-white px-5 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-slate-100"
            >
              Editar cabecera
            </Link>
          ) : null}
          <Link
            href={`/contracts/${id}/closures`}
            className="rounded-full border border-white/20 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/10"
          >
            Ver cierres
          </Link>
        </div>
      }
    >
      <ContractNav contractId={id} active="overview" userRole={user.role} />

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <article className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-[0_20px_50px_rgba(15,23,42,0.06)]">
          <h2 className="text-2xl font-semibold text-slate-950">Resumen contractual</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <DataPill label="Mandante" value={contract.clientName} />
            <DataPill label="Estado" value={contract.status} />
            <DataPill label="Moneda" value={contract.currency} />
            <DataPill label="Monto contractual" value={contract.originalAmount} />
          </div>
          {contract.description ? (
            <p className="mt-6 text-sm leading-7 text-slate-600">
              {contract.description}
            </p>
          ) : null}
        </article>

        <article className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-[0_20px_50px_rgba(15,23,42,0.06)]">
          <h2 className="text-2xl font-semibold text-slate-950">Modulos del contrato</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <ModuleCard
              href={`/contracts/${id}/items`}
              title="Partidas"
              text={`${contract.itemCount} partidas cargadas en el itemizado base.`}
            />
            {user.role === UserRole.ADMIN ? (
              <ModuleCard
                href={`/contracts/${id}/taxonomy`}
                title="Jerarquia"
                text="Administra la estructura WBS propia del contrato."
              />
            ) : null}
            <ModuleCard
              href={`/contracts/${id}/closures`}
              title="Cierres"
              text={`${contract.closureCount} cierres recientes disponibles.`}
            />
            <ModuleCard
              href={`/contracts/${id}/changes`}
              title="NOC"
              text={`${contract.changes.length} cambios cargados en la vista actual.`}
            />
          </div>
        </article>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <article className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-[0_20px_50px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-slate-950">
                Resumen operativo
              </h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                Desde aqui ya puedes saltar al itemizado completo, a los cierres mensuales o al registro de NOC.
              </p>
            </div>
            <Link
              href={`/contracts/${id}/items`}
              className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-900 hover:text-slate-950"
            >
              Ver partidas
            </Link>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {contract.items.length > 0 ? (
              contract.items.slice(0, 4).map((item: typeof contract.items[number]) => (
                <div key={item.id} className="rounded-3xl bg-slate-50 p-5">
                  <p className="text-sm font-medium text-teal-700">
                    Item {item.itemNumber}
                  </p>
                  <p className="mt-2 font-semibold text-slate-950">{item.description}</p>
                  <p className="mt-2 text-sm text-slate-600">
                    {item.originalQuantity} {item.unit} · {item.originalAmount}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Consumido: {item.consumedQuantity} / {item.consumedAmount}
                  </p>
                </div>
              ))
            ) : (
              <div className="rounded-3xl bg-slate-50 p-5 md:col-span-2">
                <p className="font-semibold text-slate-950">Itemizado pendiente</p>
                <p className="mt-2 text-sm leading-7 text-slate-600">
                  La cabecera del contrato ya esta creada. El siguiente paso es entrar al modulo de partidas para cargar el itemizado base.
                </p>
              </div>
            )}
          </div>
        </article>

        <aside className="space-y-6">
          <article className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-[0_20px_50px_rgba(15,23,42,0.06)]">
            <h2 className="text-xl font-semibold text-slate-950">Ultimos cierres</h2>
            <div className="mt-4 space-y-3">
              {contract.closures.length > 0 ? (
                contract.closures.map((closure: typeof contract.closures[number]) => (
                  <div key={closure.id} className="rounded-3xl bg-slate-50 p-4">
                    <p className="font-medium text-slate-950">
                      {closure.periodLabel} · {closure.statementNumber}
                    </p>
                    <p className="mt-2 text-sm text-slate-600">
                      Bruto {closure.grossAmount}
                    </p>
                    <p className="text-sm text-slate-600">
                      Descuentos {closure.totalDiscounts}
                    </p>
                    <p className="text-sm text-slate-600">Neto {closure.netAmount}</p>
                  </div>
                ))
              ) : (
                <EmptyText text="Aun no hay cierres para este contrato." />
              )}
            </div>
          </article>

          <article className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-[0_20px_50px_rgba(15,23,42,0.06)]">
            <h2 className="text-xl font-semibold text-slate-950">NOC recientes</h2>
            <div className="mt-4 space-y-3">
              {contract.changes.length > 0 ? (
                contract.changes.map((change: typeof contract.changes[number]) => (
                  <div key={change.id} className="rounded-3xl bg-slate-50 p-4">
                    <p className="font-medium text-slate-950">{change.title}</p>
                    <p className="mt-1 text-sm text-slate-600">
                      {change.type} · {change.status}
                    </p>
                    <p className="text-sm text-slate-500">{change.effectiveDate}</p>
                  </div>
                ))
              ) : (
                <EmptyText text="Aun no hay cambios contractuales cargados." />
              )}
            </div>
          </article>
        </aside>
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

function ModuleCard({
  href,
  title,
  text,
}: {
  href: string;
  title: string;
  text: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-3xl border border-slate-200 bg-slate-50 p-5 transition hover:border-slate-300 hover:bg-white"
    >
      <p className="text-lg font-semibold text-slate-950">{title}</p>
      <p className="mt-2 text-sm leading-7 text-slate-600">{text}</p>
    </Link>
  );
}

function EmptyText({ text }: { text: string }) {
  return <p className="text-sm leading-7 text-slate-500">{text}</p>;
}
