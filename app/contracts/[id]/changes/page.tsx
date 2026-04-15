import type { Metadata } from "next";
import { UserRole } from "@prisma/client";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ContractNav } from "@/components/contract-nav";
import { requireUser } from "@/lib/auth";
import { getContractDetailSnapshot } from "@/lib/contracts";

export const metadata: Metadata = {
  title: "NOC del contrato | Oficina Tecnica",
  description: "Cambios contractuales y trazabilidad de NOC.",
};

export const dynamic = "force-dynamic";

export default async function ContractChangesPage({
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
      pathname={`/contracts/${id}/changes`}
      title={`NOC · ${contract.code}`}
      description="Registro de cambios contractuales pendientes, aprobados o rechazados."
    >
      <ContractNav contractId={id} active="changes" />

      <section className="grid gap-5">
        {contract.changes.length > 0 ? (
          contract.changes.map((change: typeof contract.changes[number]) => (
            <article
              key={change.id}
              className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_20px_50px_rgba(15,23,42,0.06)]"
            >
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-2xl font-semibold text-slate-950">
                    {change.title}
                  </h2>
                  <p className="text-sm leading-7 text-slate-600">
                    {change.type} · {change.status}
                  </p>
                </div>
                <p className="text-sm text-slate-500">{change.effectiveDate}</p>
              </div>
            </article>
          ))
        ) : (
          <article className="rounded-[2rem] border border-dashed border-slate-300 bg-white p-8 text-center shadow-[0_20px_50px_rgba(15,23,42,0.04)]">
            <h2 className="text-2xl font-semibold text-slate-950">Sin NOC aun</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Los cambios contractuales apareceran aqui cuando se registren.
            </p>
          </article>
        )}
      </section>
    </AppShell>
  );
}
