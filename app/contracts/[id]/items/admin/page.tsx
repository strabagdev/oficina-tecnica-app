import type { Metadata } from "next";
import { UserRole } from "@prisma/client";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ContractNav } from "@/components/contract-nav";
import { FlashBanner } from "@/components/flash-banner";
import { ItemTaxonomyFields } from "@/components/item-taxonomy-fields";
import { requireUser } from "@/lib/auth";
import { getContractDetailSnapshot } from "@/lib/contracts";
import { getItemTaxonomyOptions } from "@/lib/item-taxonomy";
import { getMeasurementUnitOptions } from "@/lib/measurement-units";

export const metadata: Metadata = {
  title: "Administrar itemizado | Oficina Tecnica",
  description: "Alta, importacion y edicion del itemizado contractual.",
};

export const dynamic = "force-dynamic";

export default async function ContractItemsAdminPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();

  if (user.role !== UserRole.ADMIN) {
    notFound();
  }

  const { id } = await params;
  const [contract, measurementUnits, itemTaxonomy] = await Promise.all([
    getContractDetailSnapshot(id),
    getMeasurementUnitOptions(),
    getItemTaxonomyOptions(),
  ]);
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
      pathname={`/contracts/${id}/items/admin`}
      title={`Admin itemizado · ${contract.code}`}
      description="Administra la carga, importacion y edicion de partidas sin mezclarlo con la vista de consulta."
    >
      <ContractNav contractId={id} active="items-admin" showItemAdmin />
      <FlashBanner type={flashType} message={flashMessage} />

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <article className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_20px_50px_rgba(15,23,42,0.06)]">
          <h2 className="text-xl font-semibold text-slate-950">Agregar partida</h2>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            Ingresa partidas manualmente respetando el numero de itemizado y su clasificacion WBS.
          </p>

          <form action="/api/contract-items" method="post" className="mt-5 space-y-4">
            <input type="hidden" name="contractId" value={contract.id} />
            <input type="hidden" name="redirectTo" value={`/contracts/${id}/items/admin`} />
            <ItemTaxonomyFields
              families={itemTaxonomy.families}
              subfamilies={itemTaxonomy.subfamilies}
              groups={itemTaxonomy.groups}
              idPrefix="new-item-taxonomy"
            />
            <Field label="Numero itemizado" name="itemNumber" placeholder="1.1" />
            <Field
              label="Descripcion"
              name="description"
              placeholder="Movimiento de tierras"
            />
            <div className="grid gap-4 md:grid-cols-3">
              <SelectField
                label="Unidad"
                name="unit"
                options={measurementUnits.map((unit: { code: string; name: string }) => ({
                  value: unit.code,
                  label: `${unit.code} · ${unit.name}`,
                }))}
              />
              <Field label="Cantidad" name="quantity" placeholder="1200" />
              <Field label="Precio unitario" name="unitPrice" placeholder="18500" />
            </div>
            <button
              type="submit"
              className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Guardar partida
            </button>
          </form>
        </article>

        <article className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_20px_50px_rgba(15,23,42,0.06)]">
          <h2 className="text-xl font-semibold text-slate-950">Importar Excel</h2>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            Importa varias partidas desde un archivo <code>.xlsx</code>. La familia es obligatoria; subfamilia y grupo pueden quedar vacios.
          </p>
          <a
            href="/api/contract-items/template"
            className="mt-4 inline-flex rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-900 hover:text-slate-950"
          >
            Descargar archivo de referencia
          </a>

          <form
            action="/api/contract-items/import"
            method="post"
            encType="multipart/form-data"
            className="mt-5 space-y-4"
          >
            <input type="hidden" name="contractId" value={contract.id} />
            <input type="hidden" name="redirectTo" value={`/contracts/${id}/items/admin`} />
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700" htmlFor="file">
                Archivo Excel
              </label>
              <input
                id="file"
                name="file"
                type="file"
                accept=".xlsx,.xls"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
              />
            </div>
            <button
              type="submit"
              className="rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-900 hover:text-slate-950"
            >
              Importar XLSX
            </button>
          </form>
        </article>
      </section>

      {contract.items.length > 0 ? (
        <section className="mt-6 rounded-[2rem] border border-slate-200 bg-white p-7 shadow-[0_20px_50px_rgba(15,23,42,0.06)]">
          <h2 className="text-2xl font-semibold text-slate-950">Editar partidas</h2>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            Cada partida se puede ajustar con formulario individual. Al guardar, el monto contractual se recalcula automaticamente.
          </p>

          <div className="mt-6 grid gap-4 xl:grid-cols-2">
            {contract.items.map((item: typeof contract.items[number]) => (
              <form
                key={item.id}
                action={`/api/contract-items/${item.id}`}
                method="post"
                className="rounded-3xl border border-slate-200 bg-slate-50 p-5"
              >
                <input type="hidden" name="contractId" value={contract.id} />
                <input type="hidden" name="redirectTo" value={`/contracts/${id}/items/admin`} />
                <div className="grid gap-4 md:grid-cols-2">
                  <ItemTaxonomyFields
                    families={itemTaxonomy.families}
                    subfamilies={itemTaxonomy.subfamilies}
                    groups={itemTaxonomy.groups}
                    defaultFamilyId={
                      itemTaxonomy.families.find((family) => family.name === item.family)?.id ??
                      ""
                    }
                    defaultSubfamilyId={
                      itemTaxonomy.subfamilies.find(
                        (subfamily) => subfamily.name === item.subfamily,
                      )?.id ?? ""
                    }
                    defaultGroupId={
                      itemTaxonomy.groups.find((group) => group.name === item.itemGroup)?.id ??
                      ""
                    }
                    idPrefix={`taxonomy-${item.id}`}
                  />
                </div>
                <Field
                  label="Numero itemizado"
                  name="itemNumber"
                  defaultValue={item.itemNumberValue}
                  placeholder="1.1"
                />
                <div className="grid gap-4 md:grid-cols-2">
                  <SelectField
                    label="Unidad"
                    name="unit"
                    defaultValue={item.unit ?? ""}
                    options={measurementUnits.map((unit: { code: string; name: string }) => ({
                      value: unit.code,
                      label: `${unit.code} · ${unit.name}`,
                    }))}
                  />
                  <Field
                    label="Descripcion"
                    name="description"
                    defaultValue={item.description}
                    placeholder="Descripcion de la partida"
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field
                    label="Cantidad"
                    name="quantity"
                    defaultValue={item.originalQuantityValue}
                    placeholder="1200"
                  />
                  <Field
                    label="Precio unitario"
                    name="unitPrice"
                    defaultValue={item.unitPriceValue}
                    placeholder="18500"
                  />
                </div>
                <div className="mt-4 flex items-center justify-between gap-4">
                  <p className="text-sm text-slate-500">Monto actual: {item.originalAmount}</p>
                  <button
                    type="submit"
                    className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    Guardar cambios
                  </button>
                </div>
              </form>
            ))}
          </div>
        </section>
      ) : null}
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
      <label
        className="block text-sm font-medium text-slate-700"
        htmlFor={`${props.name}-${props.defaultValue ?? "new"}`}
      >
        {props.label}
      </label>
      <input
        id={`${props.name}-${props.defaultValue ?? "new"}`}
        name={props.name}
        placeholder={props.placeholder}
        defaultValue={props.defaultValue}
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
  const inputId = `${props.name}-${props.defaultValue ?? "new"}`;

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-700" htmlFor={inputId}>
        {props.label}
      </label>
      <select
        id={inputId}
        name={props.name}
        defaultValue={props.defaultValue ?? ""}
        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0f766e] focus:ring-4 focus:ring-[#99f6e4]"
      >
        <option value="">Selecciona unidad</option>
        {props.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
