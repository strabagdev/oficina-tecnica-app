import type { Metadata } from "next";
import Link from "next/link";
import { UserRole } from "@prisma/client";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { ContractItemsAdminClient } from "@/components/contract-items-admin-client";
import { ContractNav } from "@/components/contract-nav";
import { FlashBanner } from "@/components/flash-banner";
import { requireUser } from "@/lib/auth";
import { getContractDetailSnapshot } from "@/lib/contracts";
import { getItemTaxonomyOptions } from "@/lib/item-taxonomy";
import { getMeasurementUnitSnapshot } from "@/lib/measurement-units";

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
      <td colSpan={7} className={`px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] ${indent[level]}`}>
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
  const [contract, itemTaxonomy, measurementUnits] = await Promise.all([
    getContractDetailSnapshot(id),
    getItemTaxonomyOptions(),
    user.role === UserRole.ADMIN ? getMeasurementUnitSnapshot() : Promise.resolve([]),
  ]);
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const flashType = Array.isArray(resolvedSearchParams?.type)
    ? resolvedSearchParams?.type[0]
    : resolvedSearchParams?.type;
  const flashMessage = Array.isArray(resolvedSearchParams?.message)
    ? resolvedSearchParams?.message[0]
    : resolvedSearchParams?.message;
  const modal = Array.isArray(resolvedSearchParams?.modal)
    ? resolvedSearchParams?.modal[0] ?? ""
    : resolvedSearchParams?.modal ?? "";
  const draftFamilyId = Array.isArray(resolvedSearchParams?.draftFamilyId)
    ? resolvedSearchParams?.draftFamilyId[0] ?? ""
    : resolvedSearchParams?.draftFamilyId ?? "";
  const draftSubfamilyId = Array.isArray(resolvedSearchParams?.draftSubfamilyId)
    ? resolvedSearchParams?.draftSubfamilyId[0] ?? ""
    : resolvedSearchParams?.draftSubfamilyId ?? "";
  const draftGroupId = Array.isArray(resolvedSearchParams?.draftGroupId)
    ? resolvedSearchParams?.draftGroupId[0] ?? ""
    : resolvedSearchParams?.draftGroupId ?? "";
  const draftItemNumber = Array.isArray(resolvedSearchParams?.draftItemNumber)
    ? resolvedSearchParams?.draftItemNumber[0] ?? ""
    : resolvedSearchParams?.draftItemNumber ?? "";
  const draftDescription = Array.isArray(resolvedSearchParams?.draftDescription)
    ? resolvedSearchParams?.draftDescription[0] ?? ""
    : resolvedSearchParams?.draftDescription ?? "";
  const draftUnit = Array.isArray(resolvedSearchParams?.draftUnit)
    ? resolvedSearchParams?.draftUnit[0] ?? ""
    : resolvedSearchParams?.draftUnit ?? "";
  const draftQuantity = Array.isArray(resolvedSearchParams?.draftQuantity)
    ? resolvedSearchParams?.draftQuantity[0] ?? ""
    : resolvedSearchParams?.draftQuantity ?? "";
  const draftUnitPrice = Array.isArray(resolvedSearchParams?.draftUnitPrice)
    ? resolvedSearchParams?.draftUnitPrice[0] ?? ""
    : resolvedSearchParams?.draftUnitPrice ?? "";
  const editItemId = Array.isArray(resolvedSearchParams?.editItemId)
    ? resolvedSearchParams?.editItemId[0] ?? ""
    : resolvedSearchParams?.editItemId ?? "";
  const editFamilyId = Array.isArray(resolvedSearchParams?.editFamilyId)
    ? resolvedSearchParams?.editFamilyId[0] ?? ""
    : resolvedSearchParams?.editFamilyId ?? "";
  const editSubfamilyId = Array.isArray(resolvedSearchParams?.editSubfamilyId)
    ? resolvedSearchParams?.editSubfamilyId[0] ?? ""
    : resolvedSearchParams?.editSubfamilyId ?? "";
  const editGroupId = Array.isArray(resolvedSearchParams?.editGroupId)
    ? resolvedSearchParams?.editGroupId[0] ?? ""
    : resolvedSearchParams?.editGroupId ?? "";
  const editItemNumber = Array.isArray(resolvedSearchParams?.editItemNumber)
    ? resolvedSearchParams?.editItemNumber[0] ?? ""
    : resolvedSearchParams?.editItemNumber ?? "";
  const editDescription = Array.isArray(resolvedSearchParams?.editDescription)
    ? resolvedSearchParams?.editDescription[0] ?? ""
    : resolvedSearchParams?.editDescription ?? "";
  const editUnit = Array.isArray(resolvedSearchParams?.editUnit)
    ? resolvedSearchParams?.editUnit[0] ?? ""
    : resolvedSearchParams?.editUnit ?? "";
  const editQuantity = Array.isArray(resolvedSearchParams?.editQuantity)
    ? resolvedSearchParams?.editQuantity[0] ?? ""
    : resolvedSearchParams?.editQuantity ?? "";
  const editUnitPrice = Array.isArray(resolvedSearchParams?.editUnitPrice)
    ? resolvedSearchParams?.editUnitPrice[0] ?? ""
    : resolvedSearchParams?.editUnitPrice ?? "";
  const draftUnitCode = Array.isArray(resolvedSearchParams?.draftUnitCode)
    ? resolvedSearchParams?.draftUnitCode[0] ?? ""
    : resolvedSearchParams?.draftUnitCode ?? "";
  const draftUnitName = Array.isArray(resolvedSearchParams?.draftUnitName)
    ? resolvedSearchParams?.draftUnitName[0] ?? ""
    : resolvedSearchParams?.draftUnitName ?? "";
  const draftUnitSortOrder = Array.isArray(resolvedSearchParams?.draftUnitSortOrder)
    ? resolvedSearchParams?.draftUnitSortOrder[0] ?? ""
    : resolvedSearchParams?.draftUnitSortOrder ?? "";
  const editUnitId = Array.isArray(resolvedSearchParams?.editUnitId)
    ? resolvedSearchParams?.editUnitId[0] ?? ""
    : resolvedSearchParams?.editUnitId ?? "";
  const editUnitCode = Array.isArray(resolvedSearchParams?.editUnitCode)
    ? resolvedSearchParams?.editUnitCode[0] ?? ""
    : resolvedSearchParams?.editUnitCode ?? "";
  const editUnitName = Array.isArray(resolvedSearchParams?.editUnitName)
    ? resolvedSearchParams?.editUnitName[0] ?? ""
    : resolvedSearchParams?.editUnitName ?? "";
  const editUnitSortOrder = Array.isArray(resolvedSearchParams?.editUnitSortOrder)
    ? resolvedSearchParams?.editUnitSortOrder[0] ?? ""
    : resolvedSearchParams?.editUnitSortOrder ?? "";

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
          <Link
            href={`/contracts/${id}/closures`}
            className="rounded-full border border-white/20 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/10"
          >
            Registrar cierre
          </Link>
        </div>
      }
    >
      <ContractNav contractId={id} active="items" />
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

          {user.role === UserRole.ADMIN ? (
            <div className="mt-6">
              <ContractItemsAdminClient
                contractId={contract.id}
                contractCode={contract.code}
                items={contract.items}
                measurementUnits={measurementUnits}
                itemTaxonomy={itemTaxonomy}
                redirectTo={`/contracts/${id}/items`}
                initialModal={modal}
                createDraft={{
                  familyId: draftFamilyId,
                  subfamilyId: draftSubfamilyId,
                  groupId: draftGroupId,
                  itemNumber: draftItemNumber,
                  description: draftDescription,
                  unit: draftUnit,
                  quantity: draftQuantity,
                  unitPrice: draftUnitPrice,
                }}
                editDraft={{
                  familyId: editFamilyId,
                  subfamilyId: editSubfamilyId,
                  groupId: editGroupId,
                  itemNumber: editItemNumber,
                  description: editDescription,
                  unit: editUnit,
                  quantity: editQuantity,
                  unitPrice: editUnitPrice,
                }}
                editItemId={editItemId}
                unitDraft={{
                  code: draftUnitCode,
                  name: draftUnitName,
                  sortOrder: draftUnitSortOrder,
                }}
                unitEditDraft={{
                  unitId: editUnitId,
                  code: editUnitCode,
                  name: editUnitName,
                  sortOrder: editUnitSortOrder,
                }}
                showTable={false}
              />
            </div>
          ) : null}

          {contract.items.length > 0 ? (
            <div className="mt-6 overflow-hidden rounded-3xl border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">WBS / Item</th>
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
