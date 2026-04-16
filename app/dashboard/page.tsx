import type { Metadata } from "next";
import Link from "next/link";
import { UserRole } from "@prisma/client";
import { AppShell } from "@/components/app-shell";
import { FlashBanner } from "@/components/flash-banner";
import { requireUser } from "@/lib/auth";
import { getDashboardSnapshot } from "@/lib/dashboard";

export const metadata: Metadata = {
  title: "Panel | Oficina Tecnica",
  description: "Resumen inicial del control contractual.",
};

export const dynamic = "force-dynamic";

const roleLabels = {
  [UserRole.ADMIN]: "Administrador",
  [UserRole.VIEWER]: "Visualizador",
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [user, snapshot] = await Promise.all([
    requireUser(),
    getDashboardSnapshot(),
  ]);
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const flashType = Array.isArray(resolvedSearchParams?.type)
    ? resolvedSearchParams?.type[0]
    : resolvedSearchParams?.type;
  const flashMessage = Array.isArray(resolvedSearchParams?.message)
    ? resolvedSearchParams?.message[0]
    : resolvedSearchParams?.message;

  return (
    <AppShell
      user={user}
      pathname="/dashboard"
      title={`Bienvenido, ${user.name}`}
      description={`Perfil activo: ${roleLabels[user.role]}. Este panel resume el estado general y te deriva a contratos, cierres, NOC y usuarios segun corresponda.`}
      actions={
        <Link
          href="/contracts"
          className="rounded-full bg-white px-5 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-slate-100"
        >
          Ir a contratos
        </Link>
      }
    >
      <FlashBanner type={flashType} message={flashMessage} />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Contratos" value={snapshot.contracts} />
        <MetricCard label="Items cargados" value={snapshot.items} />
        <MetricCard label="Consumos mensuales" value={snapshot.consumptions} />
        <MetricCard label="Cierres mensuales" value={snapshot.closures} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <article className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-[0_20px_50px_rgba(15,23,42,0.06)]">
          <h2 className="text-2xl font-semibold text-slate-950">Flujo de trabajo</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <ModuleCard
              href="/contracts/new"
              title="1. Crear contrato"
              text="Parte creando el contrato y luego define su jerarquia dentro del mismo contrato."
            />
            <ModuleCard
              href="/contracts"
              title="2. Gestionar contratos"
              text="Revisa detalle, jerarquia, partidas, cierres y cambios por contrato."
            />
            <ModuleCard
              href="/contracts"
              title="3. Cierres mensuales"
              text="Desde cada contrato podras generar y revisar estados de pago."
            />
            {user.role === UserRole.ADMIN ? (
              <ModuleCard
                href="/admin/users"
                title="4. Usuarios y permisos"
                text="Administra cuentas internas y niveles de acceso."
              />
            ) : null}
          </div>
        </article>

        <article className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-[0_20px_50px_rgba(15,23,42,0.06)]">
          <h2 className="text-2xl font-semibold text-slate-950">Estado actual</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <DataPill label="Usuarios" value={String(snapshot.users.length)} />
            <DataPill label="NOC pendientes" value={String(snapshot.pendingChanges)} />
            <DataPill label="Ultimo cierre demo" value={snapshot.sampleContract.lastClosure.period} />
            <DataPill label="Neto ultimo cierre" value={snapshot.sampleContract.lastClosure.netAmount} />
          </div>
          <div className="mt-6 rounded-3xl bg-slate-50 p-5">
            <p className="text-sm font-medium text-slate-700">Reglas clave</p>
            <ul className="mt-3 space-y-3 text-sm leading-7 text-slate-600">
              {snapshot.sampleContract.discountRules.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          </div>
        </article>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <article className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-[0_20px_50px_rgba(15,23,42,0.06)]">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-2xl font-semibold text-slate-950">Contratos recientes</h2>
            <Link
              href="/contracts"
              className="text-sm font-medium text-teal-700 transition hover:text-teal-900"
            >
              Ver todos
            </Link>
          </div>
          <div className="mt-6 space-y-4">
            {snapshot.contractOptions.length > 0 ? (
              snapshot.contractOptions.slice(0, 5).map((contract) => (
                <Link
                  key={contract.id}
                  href={`/contracts/${contract.id}`}
                  className="block rounded-3xl border border-slate-200 bg-slate-50 p-4 transition hover:border-slate-300 hover:bg-white"
                >
                  <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-semibold text-slate-950">
                        {contract.code} · {contract.name}
                      </p>
                      <p className="text-sm text-slate-600">{contract.clientName}</p>
                    </div>
                    <p className="text-sm text-slate-500">{contract.status}</p>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-slate-600">
                    {contract.itemCount} items · {contract.closureCount} cierres
                  </p>
                </Link>
              ))
            ) : (
              <EmptyState text="Todavia no hay contratos cargados." />
            )}
          </div>
        </article>

        <article className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-[0_20px_50px_rgba(15,23,42,0.06)]">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-2xl font-semibold text-slate-950">Ultimos cierres</h2>
            <Link
              href={snapshot.contractOptions[0] ? `/contracts/${snapshot.contractOptions[0].id}/closures` : "/contracts"}
              className="text-sm font-medium text-teal-700 transition hover:text-teal-900"
            >
              Ver modulo
            </Link>
          </div>
          <div className="mt-6 space-y-5">
            {snapshot.recentClosures.length > 0 ? (
              snapshot.recentClosures.map((closure) => (
                <div
                  key={closure.id}
                  className="rounded-3xl border border-slate-200 bg-slate-50 p-5"
                >
                  <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-semibold text-slate-950">
                        {closure.contractLabel}
                      </p>
                      <p className="text-sm text-slate-600">
                        {closure.periodLabel} · {closure.statementNumber}
                      </p>
                    </div>
                    <p className="text-sm font-medium text-slate-700">
                      Neto {closure.netAmount}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState text="Todavia no hay cierres registrados." />
            )}
          </div>
        </article>
      </section>
    </AppShell>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <article className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">
        {value}
      </p>
    </article>
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

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm leading-7 text-slate-500">
      {text}
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
