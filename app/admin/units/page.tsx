import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { FlashBanner } from "@/components/flash-banner";
import { requireAdmin } from "@/lib/auth";
import { getMeasurementUnitSnapshot } from "@/lib/measurement-units";

export const metadata: Metadata = {
  title: "Unidades | Oficina Tecnica",
  description: "Catalogo de unidades de medida.",
};

export const dynamic = "force-dynamic";

export default async function AdminUnitsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [user, units] = await Promise.all([
    requireAdmin(),
    getMeasurementUnitSnapshot(),
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
      pathname="/admin/units"
      title="Unidades de medida"
      description="Administra el catalogo de unidades para que las partidas usen opciones consistentes desde un desplegable."
    >
      <FlashBanner type={flashType} message={flashMessage} />

      <section className="grid gap-6 xl:grid-cols-[0.72fr_1.28fr]">
        <article className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-[0_20px_50px_rgba(15,23,42,0.06)]">
          <div className="mb-6">
            <p className="text-sm font-medium text-teal-700">Catalogo</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-950">
              Crear unidad
            </h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              Define las unidades que luego estaran disponibles al crear o editar partidas.
            </p>
          </div>

          <form action="/api/measurement-units" method="post" className="space-y-5">
            <input type="hidden" name="action" value="create" />
            <input type="hidden" name="redirectTo" value="/admin/units" />
            <Field label="Codigo" name="code" placeholder="m3" />
            <Field label="Nombre" name="name" placeholder="Metro cubico" />
            <Field label="Orden" name="sortOrder" placeholder="10" />

            <button
              type="submit"
              className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Crear unidad
            </button>
          </form>
        </article>

        <article className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-[0_20px_50px_rgba(15,23,42,0.06)]">
          <div className="mb-6">
            <p className="text-sm font-medium text-teal-700">Catalogo</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-950">
              Unidades disponibles
            </h2>
          </div>

          <div className="space-y-4">
            {units.map((unit: { id: string; code: string; name: string; sortOrder: number; active: boolean }) => (
              <div
                key={unit.id}
                className="rounded-3xl border border-slate-200 bg-slate-50 p-5"
              >
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-semibold text-slate-950">
                      {unit.code} · {unit.name}
                    </p>
                    <p className="text-sm text-slate-600">Orden {unit.sortOrder}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span
                      className={`rounded-full px-3 py-1 ${
                        unit.active
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-rose-100 text-rose-700"
                      }`}
                    >
                      {unit.active ? "Activa" : "Inactiva"}
                    </span>
                  </div>
                </div>

                <form action="/api/measurement-units" method="post" className="mt-4">
                  <input type="hidden" name="action" value="toggle-active" />
                  <input type="hidden" name="unitId" value={unit.id} />
                  <input type="hidden" name="redirectTo" value="/admin/units" />
                  <input
                    type="hidden"
                    name="active"
                    value={unit.active ? "false" : "true"}
                  />
                  <button
                    type="submit"
                    className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-900 hover:text-slate-950"
                  >
                    {unit.active ? "Desactivar" : "Activar"}
                  </button>
                </form>
              </div>
            ))}
          </div>
        </article>
      </section>
    </AppShell>
  );
}

function Field(props: {
  label: string;
  name: string;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-700" htmlFor={props.name}>
        {props.label}
      </label>
      <input
        id={props.name}
        name={props.name}
        placeholder={props.placeholder}
        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0f766e] focus:ring-4 focus:ring-[#99f6e4]"
      />
    </div>
  );
}
