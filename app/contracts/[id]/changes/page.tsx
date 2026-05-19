import type { Metadata } from "next";
import { UserRole } from "@prisma/client";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import {
  ContractHeader,
  ContractShell,
  EmptyState,
  StatusBadge,
} from "@/components/contract-workspace";
import { FlashBanner } from "@/components/flash-banner";
import { requireUser } from "@/lib/auth";
import { getContractDetailSnapshot } from "@/lib/contracts";

export const metadata: Metadata = {
  title: "NOC del contrato | Oficina Tecnica",
  description: "Cambios contractuales y trazabilidad de NOC.",
};

export const dynamic = "force-dynamic";

export default async function ContractChangesPage({
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
      pathname={`/contracts/${id}/changes`}
      title={`NOC · ${contract.code}`}
      description="Registro de cambios contractuales pendientes, aprobados o rechazados."
    >
      <ContractShell
        contractId={id}
        active="changes"
        userRole={user.role}
        header={
          <ContractHeader
            code={contract.code}
            name={contract.name}
            clientName={contract.clientName}
            status={contract.status}
            meta={
              <>
                <span>Monto vigente {contract.currentAmount}</span>
                <span>NOC aplicadas {contract.appliedChangeAmount}</span>
              </>
            }
          />
        }
      >
        <FlashBanner type={flashType} message={flashMessage} />

        <section className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
          {user.role === UserRole.ADMIN ? (
            <article className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.05)]">
              <h2 className="text-lg font-semibold text-slate-950">Crear NOC</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Usa lineas EXISTENTE para modificar partidas y NUEVO para crear partidas por NOC.
              </p>
              <form action="/api/contract-changes" method="post" className="mt-5 space-y-4">
                <input type="hidden" name="action" value="create" />
                <input type="hidden" name="contractId" value={id} />
                <input type="hidden" name="redirectTo" value={`/contracts/${id}/changes`} />
                <Field label="Titulo" name="title" placeholder="NOC-001 aumento de alcance" required />
                <Field label="Fecha efectiva" name="effectiveDate" type="date" required />
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-700" htmlFor="noc-description">
                    Descripcion
                  </label>
                  <textarea
                    id="noc-description"
                    name="description"
                    rows={3}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-teal-700"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-700" htmlFor="noc-lines">
                    Lineas de impacto
                  </label>
                  <textarea
                    id="noc-lines"
                    name="lines"
                    rows={7}
                    required
                    placeholder={[
                      "EXISTENTE|1.1|10|250000|Aumento cantidad",
                      "NUEVO|1.9|Nueva partida|m3|20|15000|300000",
                    ].join("\n")}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 font-mono text-xs outline-none focus:border-teal-700"
                  />
                  <p className="text-xs leading-5 text-slate-500">
                    EXISTENTE|numeroItem|cantidadDelta|montoDelta|nota. NUEVO|numeroItem|descripcion|unidad|cantidad|precioUnitario|montoOpcional.
                  </p>
                </div>
                <button
                  type="submit"
                  className="rounded-full bg-slate-950 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
                >
                  Crear NOC
                </button>
              </form>
            </article>
          ) : null}

          <div className="grid gap-4">
            {contract.changes.length > 0 ? (
              contract.changes.map((change: typeof contract.changes[number]) => (
                <article
                  key={change.id}
                  className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.05)]"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-xl font-semibold text-slate-950">{change.title}</h2>
                        <StatusBadge label={change.status} tone={statusTone(change.status)} />
                      </div>
                      <p className="mt-1 text-sm text-slate-600">
                        {change.type} · efectiva {change.effectiveDate}
                      </p>
                      {change.description ? (
                        <p className="mt-2 text-sm leading-6 text-slate-600">{change.description}</p>
                      ) : null}
                    </div>
                    <div className="text-right text-sm">
                      <p className="font-semibold text-slate-950">{change.amountDelta || "$ 0"}</p>
                      {change.quantityDelta ? (
                        <p className="text-xs text-slate-500">Cantidad {change.quantityDelta}</p>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-100">
                    <table className="min-w-[48rem] w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-500">
                        <tr>
                          <th className="px-3 py-2">Item</th>
                          <th className="px-3 py-2">Descripcion</th>
                          <th className="px-3 py-2 text-right">Delta cant.</th>
                          <th className="px-3 py-2 text-right">Delta monto</th>
                          <th className="px-3 py-2 text-right">Antes</th>
                          <th className="px-3 py-2 text-right">Despues</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {change.lines.map((line) => (
                          <tr key={line.id}>
                            <td className="whitespace-nowrap px-3 py-2 font-mono">
                              {line.createsNewItem ? "Nuevo " : ""}
                              {line.itemNumber}
                            </td>
                            <td className="px-3 py-2">{line.description}</td>
                            <td className="whitespace-nowrap px-3 py-2 text-right">
                              {line.quantityDelta || "-"}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2 text-right">
                              {line.amountDelta}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2 text-right">
                              {line.beforeAmount || "-"}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2 text-right">
                              {line.afterAmount || "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {user.role === UserRole.ADMIN ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <ChangeAction changeId={change.id} contractId={id} action="approve" label="Aprobar" disabled={change.status !== "PENDING"} />
                      <ChangeAction changeId={change.id} contractId={id} action="reject" label="Rechazar" disabled={change.status === "APPLIED" || change.status === "REJECTED"} />
                      <ChangeAction changeId={change.id} contractId={id} action="apply" label="Aplicar" disabled={change.status !== "APPROVED"} primary />
                    </div>
                  ) : null}
                </article>
              ))
            ) : (
              <EmptyState
                title="Sin NOC aun"
                text="Los cambios contractuales apareceran aqui cuando se registren."
              />
            )}
          </div>
        </section>
      </ContractShell>
    </AppShell>
  );
}

function Field({
  label,
  name,
  placeholder,
  type = "text",
  required = false,
}: {
  label: string;
  name: string;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-700" htmlFor={`noc-${name}`}>
        {label}
      </label>
      <input
        id={`noc-${name}`}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-teal-700"
      />
    </div>
  );
}

function ChangeAction({
  changeId,
  contractId,
  action,
  label,
  disabled,
  primary = false,
}: {
  changeId: string;
  contractId: string;
  action: string;
  label: string;
  disabled: boolean;
  primary?: boolean;
}) {
  return (
    <form action="/api/contract-changes" method="post">
      <input type="hidden" name="action" value={action} />
      <input type="hidden" name="changeId" value={changeId} />
      <input type="hidden" name="redirectTo" value={`/contracts/${contractId}/changes`} />
      <button
        type="submit"
        disabled={disabled}
        className={`rounded-full px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-white disabled:text-slate-400 ${
          primary
            ? "bg-slate-950 text-white hover:bg-slate-800"
            : "border border-slate-300 text-slate-700 hover:border-slate-900 hover:text-slate-950"
        }`}
      >
        {label}
      </button>
    </form>
  );
}

function statusTone(status: string): "teal" | "sky" | "rose" | "amber" {
  if (status === "APPLIED") {
    return "teal";
  }

  if (status === "APPROVED") {
    return "sky";
  }

  if (status === "REJECTED") {
    return "rose";
  }

  return "amber";
}
