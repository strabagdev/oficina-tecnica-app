import type { Metadata } from "next";
import { UserRole } from "@prisma/client";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ContractForecastEditorClient } from "@/components/contract-forecast-editor-client";
import {
  ContractHeader,
  ContractKpiStrip,
  ContractShell,
  EmptyState,
  StatusBadge,
} from "@/components/contract-workspace";
import { FlashBanner } from "@/components/flash-banner";
import { requireUser } from "@/lib/auth";
import { getContractForecastWorkspace } from "@/lib/forecast";

export const metadata: Metadata = {
  title: "Forecast contractual | Oficina Tecnica",
  description: "Proyeccion contractual simple por saldo vigente.",
};

export const dynamic = "force-dynamic";

export default async function ContractForecastPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const forecast = await getContractForecastWorkspace(id);
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const flashType = Array.isArray(resolvedSearchParams?.type)
    ? resolvedSearchParams?.type[0]
    : resolvedSearchParams?.type;
  const flashMessage = Array.isArray(resolvedSearchParams?.message)
    ? resolvedSearchParams?.message[0]
    : resolvedSearchParams?.message;

  if (!forecast) {
    notFound();
  }

  return (
    <AppShell
      user={user}
      pathname={`/contracts/${id}/forecast`}
      title={`Forecast · ${forecast.contract.code}`}
      description="Proyeccion del saldo contractual pendiente de consumir o cobrar."
    >
      <ContractShell
        contractId={id}
        active="forecast"
        userRole={user.role}
        header={
          <ContractHeader
            code={forecast.contract.code}
            name={forecast.contract.name}
            clientName={forecast.contract.clientName}
            status={forecast.contract.status}
            meta={
              <>
                <span>Monto vigente {forecast.metrics.currentContractAmount}</span>
                <span>Inicio forecast {String(forecast.basis.startMonth).padStart(2, "0")}/{forecast.basis.startYear}</span>
              </>
            }
          />
        }
      >
        <FlashBanner type={flashType} message={flashMessage} />

        <ContractKpiStrip
          items={[
            {
              label: "Monto vigente",
              value: forecast.metrics.currentContractAmount,
              helper: "Contrato original + NOC aplicadas",
              tone: "slate",
            },
            {
              label: "EDP acumulado",
              value: forecast.metrics.edpAccumulatedAmount,
              helper: "Solo EDP oficiales CLOSED",
              tone: "teal",
            },
            {
              label: "Saldo vigente",
              value: forecast.metrics.remainingAmount,
              helper: "Base del forecast",
              tone: "sky",
            },
            {
              label: "Cierre estimado",
              value: forecast.metrics.closingEstimateAmount,
              helper: forecast.metrics.estimatedCloseLabel,
              tone: "amber",
            },
          ]}
        />

        <section className="grid gap-4 xl:grid-cols-[1.4fr_0.6fr]">
          <ContractForecastEditorClient
            contractId={id}
            redirectTo={`/contracts/${id}/forecast`}
            currency={forecast.contract.currency}
            remainingAmountValue={forecast.metrics.remainingAmountValue}
            draftId={forecast.draft?.id ?? null}
            canEdit={user.role === UserRole.ADMIN}
            realLines={forecast.realLines}
            initialLines={forecast.forecastLines}
          />

          <aside className="space-y-4">
            <article className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.05)]">
              <h2 className="text-lg font-semibold text-slate-950">Estado</h2>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-600">Borrador</span>
                  <StatusBadge
                    label={forecast.draft ? `v${forecast.draft.version}` : "Simulacion"}
                    tone={forecast.draft ? "teal" : "slate"}
                  />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-600">Diferencia</span>
                  <span className="font-semibold text-slate-950">
                    {forecast.metrics.differenceAmount}
                  </span>
                </div>
              </div>
            </article>

            <article className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.05)]">
              <h2 className="text-lg font-semibold text-slate-950">Forecast aprobados</h2>
              <div className="mt-4 space-y-3">
                {forecast.approvedForecasts.length > 0 ? (
                  forecast.approvedForecasts.map((item) => (
                    <div key={item.id} className="rounded-2xl bg-slate-50 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium text-slate-950">v{item.version}</p>
                        <StatusBadge
                          label={item.status}
                          tone={item.status === "OUTDATED" ? "amber" : "teal"}
                        />
                      </div>
                      <p className="mt-2 text-sm text-slate-600">
                        Total {item.totalForecastAmount}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">{item.approvedAt}</p>
                    </div>
                  ))
                ) : (
                  <EmptyState
                    title="Sin aprobados"
                    text="Al aprobar un forecast quedara como historico y generara snapshot."
                  />
                )}
              </div>
            </article>

            <article className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.05)]">
              <h2 className="text-lg font-semibold text-slate-950">Snapshots</h2>
              <div className="mt-4 space-y-3">
                {forecast.snapshots.length > 0 ? (
                  forecast.snapshots.map((snapshot) => (
                    <div key={snapshot.id} className="rounded-2xl bg-slate-50 p-4">
                      <p className="font-medium text-slate-950">Snapshot v{snapshot.version}</p>
                      <p className="mt-1 text-sm text-slate-600">
                        {snapshot.totalForecastAmount} · cierre {snapshot.estimatedCloseLabel}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">{snapshot.approvedAt}</p>
                    </div>
                  ))
                ) : (
                  <EmptyState
                    title="Sin snapshots"
                    text="Los snapshots se generan al aprobar."
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
