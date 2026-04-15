import type { Metadata } from "next";
import Link from "next/link";
import { UserRole } from "@prisma/client";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { ContractNav } from "@/components/contract-nav";
import { FlashBanner } from "@/components/flash-banner";
import { requireUser } from "@/lib/auth";
import { getContractDetailSnapshot } from "@/lib/contracts";
import { getItemTaxonomyOptions } from "@/lib/item-taxonomy";

export const metadata: Metadata = {
  title: "Partidas del contrato | Oficina Tecnica",
  description: "Itemizado base y avance acumulado por partida.",
};

export const dynamic = "force-dynamic";

type ItemTaxonomyData = {
  families: { name: string; wbs?: string | null }[];
  subfamilies: { name: string; wbs?: string | null }[];
  groups: { name: string; wbs?: string | null }[];
};

function resolveItemHierarchy(
  item: {
    family: string | null;
    subfamily: string | null;
    itemGroup: string | null;
  },
  taxonomy: ItemTaxonomyData,
) {
  const family = taxonomy.families.find((entry) => entry.name === item.family) ?? null;
  const subfamily =
    taxonomy.subfamilies.find((entry) => entry.name === item.subfamily) ?? null;
  const group = taxonomy.groups.find((entry) => entry.name === item.itemGroup) ?? null;

  return {
    familyName: item.family,
    familyWbs: family?.wbs ?? null,
    familyKey: item.family ? `${family?.wbs ?? "sin-wbs"}::${item.family}` : null,
    subfamilyName: item.subfamily,
    subfamilyWbs: subfamily?.wbs ?? null,
    subfamilyKey: item.subfamily
      ? `${subfamily?.wbs ?? "sin-wbs"}::${item.subfamily}`
      : null,
    groupName: item.itemGroup,
    groupWbs: group?.wbs ?? null,
    groupKey: item.itemGroup ? `${group?.wbs ?? "sin-wbs"}::${item.itemGroup}` : null,
    displayWbs: group?.wbs ?? subfamily?.wbs ?? family?.wbs ?? "-",
  };
}

function HierarchyRow({
  level,
  wbs,
  name,
}: {
  level: "family" | "subfamily" | "group";
  wbs: string | null;
  name: string | null;
}) {
  const styles = {
    family: "bg-slate-100 text-slate-950",
    subfamily: "bg-slate-50 text-slate-900",
    group: "bg-white text-slate-800",
  } as const;

  const indent = {
    family: "",
    subfamily: "pl-6",
    group: "pl-10",
  } as const;

  return (
    <tr className={styles[level]}>
      <td colSpan={8} className={`px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] ${indent[level]}`}>
        {wbs || "Sin WBS"} · {name}
      </td>
    </tr>
  );
}

export default async function ContractItemsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const [contract, itemTaxonomy] = await Promise.all([
    getContractDetailSnapshot(id),
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

  const itemRows = (() => {
    let previousFamilyKey: string | null = null;
    let previousSubfamilyKey: string | null = null;
    let previousGroupKey: string | null = null;

    return contract.items.flatMap((item: typeof contract.items[number]) => {
      const hierarchy = resolveItemHierarchy(item, itemTaxonomy);
      const rows: ReactNode[] = [];

      if (hierarchy.familyKey && hierarchy.familyKey !== previousFamilyKey) {
        rows.push(
          <HierarchyRow
            key={`${item.id}-family`}
            level="family"
            wbs={hierarchy.familyWbs}
            name={hierarchy.familyName}
          />,
        );
        previousFamilyKey = hierarchy.familyKey;
        previousSubfamilyKey = null;
        previousGroupKey = null;
      }

      if (hierarchy.subfamilyKey && hierarchy.subfamilyKey !== previousSubfamilyKey) {
        rows.push(
          <HierarchyRow
            key={`${item.id}-subfamily`}
            level="subfamily"
            wbs={hierarchy.subfamilyWbs}
            name={hierarchy.subfamilyName}
          />,
        );
        previousSubfamilyKey = hierarchy.subfamilyKey;
        previousGroupKey = null;
      }

      if (hierarchy.groupKey && hierarchy.groupKey !== previousGroupKey) {
        rows.push(
          <HierarchyRow
            key={`${item.id}-group`}
            level="group"
            wbs={hierarchy.groupWbs}
            name={hierarchy.groupName}
          />,
        );
        previousGroupKey = hierarchy.groupKey;
      }

      rows.push(
        <tr key={item.id}>
          <td className="px-4 py-4 font-medium text-slate-900">{item.itemNumber}</td>
          <td className="px-4 py-4 text-slate-600">{hierarchy.displayWbs}</td>
          <td className="px-4 py-4 text-slate-600">{item.description}</td>
          <td className="px-4 py-4 text-slate-600">{item.unit}</td>
          <td className="px-4 py-4 text-slate-600">{item.originalQuantity}</td>
          <td className="px-4 py-4 text-slate-600">{item.unitPrice}</td>
          <td className="px-4 py-4 text-slate-600">{item.originalAmount}</td>
          <td className="px-4 py-4 text-slate-600">
            {item.consumedQuantity} / {item.consumedAmount}
          </td>
        </tr>,
      );

      return rows;
    });
  })();

  return (
    <AppShell
      user={user}
      pathname={`/contracts/${id}/items`}
      title={`Partidas · ${contract.code}`}
      description="Consulta el itemizado contractual, el presupuesto base y el avance consumido acumulado."
      actions={
        <div className="flex flex-wrap gap-2">
          <a
            href={`/api/contracts/${id}/items/export`}
            className="rounded-full bg-white px-5 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-slate-100"
          >
            Exportar XLSX
          </a>
          {user.role === UserRole.ADMIN ? (
            <Link
              href={`/contracts/${id}/items/admin`}
              className="rounded-full bg-white px-5 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-slate-100"
            >
              Administrar itemizado
            </Link>
          ) : null}
          <Link
            href={`/contracts/${id}/closures`}
            className="rounded-full border border-white/20 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/10"
          >
            Registrar cierre
          </Link>
        </div>
      }
    >
      <ContractNav contractId={id} active="items" showItemAdmin={user.role === UserRole.ADMIN} />
      <FlashBanner type={flashType} message={flashMessage} />

      <section>
        <article className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-[0_20px_50px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-slate-950">
                Itemizado del contrato
              </h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                Este modulo te muestra las partidas base y cuanto se ha consumido a la fecha.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <Pill label={`${contract.itemCount} partidas`} />
              <Pill label={`${contract.closureCount} cierres`} />
            </div>
          </div>

          {contract.items.length > 0 ? (
            <div className="mt-6 overflow-hidden rounded-3xl border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">N item</th>
                    <th className="px-4 py-3 font-medium">WBS</th>
                    <th className="px-4 py-3 font-medium">Descripcion</th>
                    <th className="px-4 py-3 font-medium">Unidad</th>
                    <th className="px-4 py-3 font-medium">Cantidad base</th>
                    <th className="px-4 py-3 font-medium">Precio unitario</th>
                    <th className="px-4 py-3 font-medium">Monto base</th>
                    <th className="px-4 py-3 font-medium">Consumido</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {itemRows}
                </tbody>
              </table>
            </div>
          ) : (
            <article className="mt-6 rounded-[1.75rem] border border-dashed border-slate-300 bg-slate-50 p-6">
              <h3 className="text-lg font-semibold text-slate-950">
                Aun no hay partidas cargadas
              </h3>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                Este contrato ya existe, pero su itemizado todavia no ha sido ingresado. Puedes cargarlo cuando quieras desde esta misma pantalla.
              </p>
            </article>
          )}
        </article>
      </section>
    </AppShell>
  );
}

function Pill({ label }: { label: string }) {
  return (
    <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">
      {label}
    </span>
  );
}
