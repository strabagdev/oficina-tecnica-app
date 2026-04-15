import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth";
import { getContractListSnapshot } from "@/lib/contracts";

export const metadata: Metadata = {
  title: "Contratos | Oficina Tecnica",
  description: "Listado y acceso a contratos.",
};

export const dynamic = "force-dynamic";

export default async function ContractsPage() {
  const [user, contracts] = await Promise.all([
    requireUser(),
    getContractListSnapshot(),
  ]);

  return (
    <AppShell
      user={user}
      pathname="/contracts"
      title="Contratos"
      description="Accede al listado de contratos y entra directo a resumen, partidas, cierres o NOC segun la etapa de trabajo."
      actions={
        <Link
          href="/contracts/new"
          className="rounded-full bg-white px-5 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-slate-100"
        >
          Nuevo contrato
        </Link>
      }
    >
      <section className="grid gap-5">
        {contracts.length > 0 ? (
          contracts.map((contract) => (
            <article
              key={contract.id}
              className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_20px_50px_rgba(15,23,42,0.06)]"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-sm font-medium text-teal-700">{contract.code}</p>
                  <h2 className="mt-1 text-2xl font-semibold text-slate-950">
                    {contract.name}
                  </h2>
                  <p className="mt-2 text-sm leading-7 text-slate-600">
                    {contract.clientName}
                  </p>
                  {contract.description ? (
                    <p className="mt-2 text-sm leading-7 text-slate-500">
                      {contract.description}
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-2 text-xs">
                  <Pill label={contract.status} />
                  <Pill label={`${contract.itemCount} items`} />
                  <Pill label={`${contract.closureCount} cierres`} />
                  <Pill label={`${contract.pendingChanges} NOC`} />
                </div>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-4">
                <DataPill label="Monto contractual" value={contract.originalAmount} />
                <DataPill label="Moneda" value={contract.currency} />
                <DataPill label="Cierres" value={String(contract.closureCount)} />
                <DataPill label="Partidas" value={String(contract.itemCount)} />
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href={`/contracts/${contract.id}`}
                  className="rounded-full bg-slate-950 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
                >
                  Resumen
                </Link>
                <Link
                  href={`/contracts/${contract.id}/items`}
                  className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-900 hover:text-slate-950"
                >
                  Partidas
                </Link>
                <Link
                  href={`/contracts/${contract.id}/closures`}
                  className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-900 hover:text-slate-950"
                >
                  Ver cierres
                </Link>
                <Link
                  href={`/contracts/${contract.id}/changes`}
                  className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-900 hover:text-slate-950"
                >
                  Ver NOC
                </Link>
              </div>
            </article>
          ))
        ) : (
          <EmptyState
            title="Aun no hay contratos"
            text="Crea el primer contrato para empezar a cargar itemizados, consumos y cierres."
          />
        )}
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

function Pill({ label }: { label: string }) {
  return (
    <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">
      {label}
    </span>
  );
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <article className="rounded-[2rem] border border-dashed border-slate-300 bg-white p-8 text-center shadow-[0_20px_50px_rgba(15,23,42,0.04)]">
      <h2 className="text-2xl font-semibold text-slate-950">{title}</h2>
      <p className="mt-3 text-sm leading-7 text-slate-600">{text}</p>
    </article>
  );
}
