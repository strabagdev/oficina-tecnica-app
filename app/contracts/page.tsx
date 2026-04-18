import type { Metadata } from "next";
import Link from "next/link";
import { UserRole } from "@prisma/client";
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
    >
      <section className="grid gap-5">
        <div className="flex items-center justify-end">
          {user.role === UserRole.ADMIN ? (
            <Link
              href="/contracts/new"
              aria-label="Nuevo contrato"
              title="Nuevo contrato"
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-950 bg-slate-950 text-white transition hover:bg-slate-800"
            >
              <PlusIcon />
            </Link>
          ) : null}
        </div>
        {contracts.length > 0 ? (
          contracts.map((contract) => (
            <article
              key={contract.id}
              className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_20px_50px_rgba(15,23,42,0.06)]"
            >
              <div>
                <p className="text-sm font-medium text-teal-700">{contract.code}</p>
                <h2 className="mt-1 text-2xl font-semibold text-slate-950">{contract.name}</h2>
              </div>

              <div className="mt-5 flex flex-nowrap gap-3 overflow-x-auto pb-1">
                <Link
                  href={`/contracts/${contract.id}`}
                  className="whitespace-nowrap rounded-full bg-slate-950 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
                >
                  Resumen
                </Link>
                <Link
                  href={`/contracts/${contract.id}/items`}
                  className="whitespace-nowrap rounded-full border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-900 hover:text-slate-950"
                >
                  Partidas
                </Link>
                <Link
                  href={`/contracts/${contract.id}/closures`}
                  className="whitespace-nowrap rounded-full border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-900 hover:text-slate-950"
                >
                  Ver cierres
                </Link>
                <Link
                  href={`/contracts/${contract.id}/changes`}
                  className="whitespace-nowrap rounded-full border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-900 hover:text-slate-950"
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

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <article className="rounded-[2rem] border border-dashed border-slate-300 bg-white p-8 text-center shadow-[0_20px_50px_rgba(15,23,42,0.04)]">
      <h2 className="text-2xl font-semibold text-slate-950">{title}</h2>
      <p className="mt-3 text-sm leading-7 text-slate-600">{text}</p>
    </article>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-[2]">
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}
