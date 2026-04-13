import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Oficina Tecnica Contractual",
  description:
    "Control de itemizados, consumos mensuales y cambios NOC para contratos.",
};

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getCurrentUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#f4f7f4] text-slate-950">
      <section className="relative isolate px-6 py-8 md:px-10">
        <div className="absolute inset-x-0 top-0 -z-10 h-[34rem] bg-[radial-gradient(circle_at_top_left,#99f6e4,transparent_28%),radial-gradient(circle_at_top_right,#bfdbfe,transparent_26%),linear-gradient(180deg,#f8fafc_0%,#f4f7f4_100%)]" />

        <div className="mx-auto flex max-w-7xl items-center justify-between rounded-full border border-white/70 bg-white/80 px-5 py-3 shadow-[0_14px_40px_rgba(15,23,42,0.06)] backdrop-blur">
          <div>
            <p className="text-sm font-semibold tracking-[0.25em] text-slate-950">
              OFICINA TECNICA
            </p>
            <p className="text-xs text-slate-500">
              Control contractual y seguimiento mensual
            </p>
          </div>

          <Link
            href="/login"
            className="rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Ingresar
          </Link>
        </div>

        <div className="mx-auto mt-10 grid max-w-7xl gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-[2.5rem] border border-white/70 bg-white/75 p-8 shadow-[0_30px_80px_rgba(15,23,42,0.08)] backdrop-blur md:p-12">
            <span className="inline-flex rounded-full bg-teal-100 px-4 py-1 text-sm font-medium text-teal-900">
              Base inicial para Railway
            </span>
            <h1 className="mt-6 max-w-4xl text-5xl font-semibold tracking-tight md:text-7xl">
              Del itemizado del contrato al control real de consumo y NOC.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
              Partimos con una fundacion simple y util: login por roles, sesion
              segura y estructura de datos para registrar contrato, presupuesto,
              consumo mensual y cualquier cambio contractual.
            </p>

            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <Link
                href="/login"
                className="rounded-full bg-[#0f766e] px-6 py-3 text-center text-sm font-semibold text-white transition hover:bg-[#115e59]"
              >
                Entrar al sistema
              </Link>
              <a
                href="#alcance"
                className="rounded-full border border-slate-300 px-6 py-3 text-center text-sm font-semibold text-slate-700 transition hover:border-slate-900 hover:text-slate-950"
              >
                Ver alcance inicial
              </a>
            </div>
          </div>

          <div className="grid gap-5">
            <article className="rounded-[2rem] bg-slate-950 p-8 text-white shadow-[0_24px_60px_rgba(15,23,42,0.2)]">
              <p className="text-sm uppercase tracking-[0.3em] text-teal-200">
                Lo que ya contempla
              </p>
              <ul className="mt-6 space-y-4 text-sm leading-7 text-slate-300">
                <li>Modelo para contratos, items, consumos y cambios NOC.</li>
                <li>Perfiles diferenciados para administracion y consulta.</li>
                <li>Sesion persistente con cookie segura y tabla de sesiones.</li>
                <li>Base lista para crecer a CRUD, reportes y carga masiva.</li>
              </ul>
            </article>

            <article
              id="alcance"
              className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-[0_20px_50px_rgba(15,23,42,0.06)]"
            >
              <div className="grid gap-5 md:grid-cols-2">
                <InfoCard
                  title="Contrato"
                  description="Cabecera contractual, cliente, monto original, fechas y estado."
                />
                <InfoCard
                  title="Itemizado"
                  description="Detalle por partida con cantidades, precios unitarios y monto base."
                />
                <InfoCard
                  title="Consumo Mensual"
                  description="Seguimiento por item y por mes para controlar ejecucion acumulada."
                />
                <InfoCard
                  title="NOC"
                  description="Cambios aprobados o pendientes que afectan cantidades o montos."
                />
              </div>
            </article>
          </div>
        </div>
      </section>
    </main>
  );
}

function InfoCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-3xl bg-slate-50 p-5">
      <p className="text-base font-semibold text-slate-950">{title}</p>
      <p className="mt-2 text-sm leading-7 text-slate-600">{description}</p>
    </div>
  );
}
