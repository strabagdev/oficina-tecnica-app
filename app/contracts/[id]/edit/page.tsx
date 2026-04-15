import type { Metadata } from "next";
import Link from "next/link";
import { UserRole } from "@prisma/client";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ContractNav } from "@/components/contract-nav";
import { FlashBanner } from "@/components/flash-banner";
import { requireAdmin } from "@/lib/auth";
import { getContractDetailSnapshot } from "@/lib/contracts";

export const metadata: Metadata = {
  title: "Editar contrato | Oficina Tecnica",
  description: "Edicion de la cabecera contractual.",
};

export const dynamic = "force-dynamic";

export default async function EditContractPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireAdmin();
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
      pathname={`/contracts/${id}`}
      title={`Editar · ${contract.code}`}
      description="Actualiza la cabecera del contrato sin mezclarla con las partidas ni con los cierres."
      actions={
        <Link
          href={`/contracts/${id}`}
          className="rounded-full bg-white px-5 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-slate-100"
        >
          Volver al contrato
        </Link>
      }
    >
      <ContractNav contractId={id} active="overview" />
      <FlashBanner type={flashType} message={flashMessage} />

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <article className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-[0_20px_50px_rgba(15,23,42,0.06)]">
          <h2 className="text-2xl font-semibold text-slate-950">Editar cabecera</h2>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            Aqui solo ajustas los datos generales del contrato. El itemizado, los cierres y los NOC se mantienen en sus modulos propios.
          </p>

          <form action={`/api/contracts/${id}`} method="post" className="mt-6 space-y-5">
            <input type="hidden" name="redirectTo" value={`/contracts/${id}/edit`} />

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Codigo" name="code" defaultValue={contract.code} />
              <Field label="Mandante" name="clientName" defaultValue={contract.clientName} />
            </div>

            <Field label="Nombre del contrato" name="name" defaultValue={contract.name} />
            <Field
              label="Descripcion"
              name="description"
              defaultValue={contract.descriptionValue}
              placeholder="Opcional"
            />

            <div className="grid gap-4 md:grid-cols-4">
              <Field label="Moneda" name="currency" defaultValue={contract.currency} />
              <SelectField
                label="Estado"
                name="status"
                defaultValue={contract.statusValue}
                options={[
                  { value: "DRAFT", label: "Borrador" },
                  { value: "ACTIVE", label: "Activo" },
                  { value: "ON_HOLD", label: "En pausa" },
                  { value: "CLOSED", label: "Cerrado" },
                ]}
              />
              <Field
                label="Inicio"
                name="startDate"
                type="date"
                defaultValue={contract.startDateValue}
              />
              <Field
                label="Termino"
                name="endDate"
                type="date"
                defaultValue={contract.endDateValue}
              />
            </div>

            <button
              type="submit"
              className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Guardar cabecera
            </button>
          </form>
        </article>

        <aside className="space-y-6">
          <InfoCard
            title="Separacion de etapas"
            lines={[
              "Crear contrato: genera la cabecera inicial.",
              "Editar contrato: ajusta la cabecera despues.",
              "Partidas: se crean, importan y editan en su modulo propio.",
            ]}
          />
          <InfoCard
            title="Siguiente paso"
            lines={[
              "Si cambias datos generales y luego necesitas trabajar el presupuesto, vuelve al modulo de partidas del contrato.",
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
  defaultValue?: string;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-700" htmlFor={props.name}>
        {props.label}
      </label>
      <input
        id={props.name}
        name={props.name}
        type={props.type ?? "text"}
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
  defaultValue?: string;
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
        defaultValue={props.defaultValue}
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
