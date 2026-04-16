import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { FlashBanner } from "@/components/flash-banner";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Nuevo contrato | Oficina Tecnica",
  description: "Creacion inicial de contratos y definicion posterior de su jerarquia propia.",
};

export const dynamic = "force-dynamic";

export default async function NewContractPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireAdmin();
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
      pathname="/contracts/new"
      title="Nuevo contrato"
      description="Crea la cabecera del contrato. Luego definiras su jerarquia WBS propia antes de cargar partidas."
    >
      <FlashBanner type={flashType} message={flashMessage} />

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <article className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-[0_20px_50px_rgba(15,23,42,0.06)]">
          <h2 className="text-2xl font-semibold text-slate-950">
            Crear contrato
          </h2>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            Primero crea la cabecera contractual. El siguiente paso sera definir la jerarquia WBS propia del contrato y despues cargar el itemizado.
          </p>

          <form action="/api/contracts" method="post" className="mt-6 space-y-5">
            <input type="hidden" name="redirectTo" value="/contracts/new" />

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Codigo" name="code" placeholder="CT-2026-001" />
              <Field
                label="Mandante"
                name="clientName"
                placeholder="MOP / Municipalidad / Cliente"
              />
            </div>

            <Field
              label="Nombre del contrato"
              name="name"
              placeholder="Conservacion vial..."
            />

            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Moneda" name="currency" placeholder="CLP" defaultValue="CLP" />
              <SelectField
                label="Estado"
                name="status"
                options={[
                  { value: "DRAFT", label: "Borrador" },
                  { value: "ACTIVE", label: "Activo" },
                  { value: "ON_HOLD", label: "En pausa" },
                  { value: "CLOSED", label: "Cerrado" },
                ]}
              />
              <Field label="Descripcion" name="description" placeholder="Opcional" />
            </div>

            <button
              type="submit"
              className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Crear contrato
            </button>
          </form>
        </article>

        <aside className="space-y-6">
          <InfoCard
            title="Flujo recomendado"
            lines={[
              "1. Crear contrato",
              "2. Definir jerarquia WBS",
              "3. Cargar itemizado base",
              "4. Registrar avances mensuales",
              "5. Emitir cierres y estados de pago",
            ]}
          />
          <InfoCard
            title="Siguiente modulo"
            lines={[
              "Despues de crear el contrato, pasaras a su modulo de jerarquia para estructurar familia, subfamilia y grupo antes de cargar partidas.",
            ]}
          />
        </aside>
      </section>
    </AppShell>
  );
}

function Field(props: {
  label: string;
  name: string;
  placeholder?: string;
  defaultValue?: string;
}) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-700" htmlFor={props.name}>
        {props.label}
      </label>
      <input
        id={props.name}
        name={props.name}
        defaultValue={props.defaultValue}
        placeholder={props.placeholder}
        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0f766e] focus:ring-4 focus:ring-[#99f6e4]"
      />
    </div>
  );
}

function SelectField(props: {
  label: string;
  name: string;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-700" htmlFor={props.name}>
        {props.label}
      </label>
      <select
        id={props.name}
        name={props.name}
        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0f766e] focus:ring-4 focus:ring-[#99f6e4]"
      >
        {props.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function InfoCard({ title, lines }: { title: string; lines: string[] }) {
  return (
    <article className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_20px_50px_rgba(15,23,42,0.06)]">
      <h2 className="text-xl font-semibold text-slate-950">{title}</h2>
      <ul className="mt-4 space-y-3 text-sm leading-7 text-slate-600">
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </article>
  );
}
