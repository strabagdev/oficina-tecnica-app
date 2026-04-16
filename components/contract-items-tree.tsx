"use client";

import { useEffect, useMemo, useState } from "react";

type ItemRow = {
  id: string;
  itemNumber: string;
  description: string;
  unit: string | null;
  originalQuantity: string;
  unitPrice: string;
  originalAmount: string;
  consumedQuantity: string;
  consumedAmount: string;
};

type GroupRow = {
  key: string;
  wbs: string | null;
  name: string | null;
  items: ItemRow[];
};

type SubfamilyRow = {
  key: string;
  wbs: string | null;
  name: string | null;
  items: ItemRow[];
  groups: GroupRow[];
};

type FamilyRow = {
  key: string;
  wbs: string | null;
  name: string | null;
  items: ItemRow[];
  subfamilies: SubfamilyRow[];
  groups: GroupRow[];
};

export function ContractItemsTree({
  contractId,
  families,
  editMode = false,
}: {
  contractId: string;
  families: FamilyRow[];
  editMode?: boolean;
}) {
  const [collapsedFamilies, setCollapsedFamilies] = useState<Record<string, boolean>>({});
  const [collapsedSubfamilies, setCollapsedSubfamilies] = useState<Record<string, boolean>>({});
  const storageKey = `contract-items-tree:${contractId}`;

  const familyCount = families.length;
  const subfamilyCount = useMemo(
    () => families.reduce((total, family) => total + family.subfamilies.length, 0),
    [families],
  );

  useEffect(() => {
    try {
      const rawState = window.localStorage.getItem(storageKey);

      if (!rawState) {
        return;
      }

      const parsedState = JSON.parse(rawState) as {
        collapsedFamilies?: Record<string, boolean>;
        collapsedSubfamilies?: Record<string, boolean>;
      };

      setCollapsedFamilies(parsedState.collapsedFamilies ?? {});
      setCollapsedSubfamilies(parsedState.collapsedSubfamilies ?? {});
    } catch {
      window.localStorage.removeItem(storageKey);
    }
  }, [storageKey]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({
          collapsedFamilies,
          collapsedSubfamilies,
        }),
      );
    } catch {
      // Ignore storage failures and keep the tree usable in-memory.
    }
  }, [collapsedFamilies, collapsedSubfamilies, storageKey]);

  return (
    <div className="mt-6 overflow-hidden rounded-3xl border border-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
        <span>Vista jerarquica del itemizado</span>
        <span>
          {familyCount} familias · {subfamilyCount} subfamilias
        </span>
      </div>
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
          {families.map((family) => {
            const isFamilyCollapsed = collapsedFamilies[family.key] ?? false;

            return (
              <FamilySection
                key={family.key}
                family={family}
                editMode={editMode}
                collapsed={isFamilyCollapsed}
                onToggle={() =>
                  setCollapsedFamilies((current) => ({
                    ...current,
                    [family.key]: !isFamilyCollapsed,
                  }))
                }
                collapsedSubfamilies={collapsedSubfamilies}
                onToggleSubfamily={(subfamilyKey, collapsed) =>
                  setCollapsedSubfamilies((current) => ({
                    ...current,
                    [subfamilyKey]: collapsed,
                  }))
                }
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function FamilySection({
  family,
  editMode,
  collapsed,
  onToggle,
  collapsedSubfamilies,
  onToggleSubfamily,
}: {
  family: FamilyRow;
  editMode: boolean;
  collapsed: boolean;
  onToggle: () => void;
  collapsedSubfamilies: Record<string, boolean>;
  onToggleSubfamily: (subfamilyKey: string, collapsed: boolean) => void;
}) {
  return (
    <>
      <HierarchyToggleRow
        level="family"
        wbs={family.wbs}
        name={family.name}
        collapsed={collapsed}
        onToggle={onToggle}
        itemCount={
          family.items.length +
          family.groups.reduce((total, group) => total + group.items.length, 0) +
          family.subfamilies.reduce(
            (total, subfamily) =>
              total +
              subfamily.items.length +
              subfamily.groups.reduce((groupTotal, group) => groupTotal + group.items.length, 0),
            0,
          )
        }
      />
      {collapsed
        ? null
        : (
          <>
            {family.items.map((item) => (
              <ItemDataRow key={item.id} item={item} indent="pl-6" editMode={editMode} />
            ))}
            {family.groups.map((group) => (
              <GroupSection key={group.key} group={group} indentLevel="group" editMode={editMode} />
            ))}
            {family.subfamilies.map((subfamily) => {
              const isSubfamilyCollapsed = collapsedSubfamilies[subfamily.key] ?? false;

              return (
                <SubfamilySection
                  key={subfamily.key}
                  subfamily={subfamily}
                  editMode={editMode}
                  collapsed={isSubfamilyCollapsed}
                  onToggle={() => onToggleSubfamily(subfamily.key, !isSubfamilyCollapsed)}
                />
              );
            })}
          </>
        )}
    </>
  );
}

function SubfamilySection({
  subfamily,
  editMode,
  collapsed,
  onToggle,
}: {
  subfamily: SubfamilyRow;
  editMode: boolean;
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <HierarchyToggleRow
        level="subfamily"
        wbs={subfamily.wbs}
        name={subfamily.name}
        collapsed={collapsed}
        onToggle={onToggle}
        itemCount={
          subfamily.items.length +
          subfamily.groups.reduce((total, group) => total + group.items.length, 0)
        }
      />
      {collapsed
        ? null
        : (
          <>
            {subfamily.items.map((item) => (
              <ItemDataRow key={item.id} item={item} indent="pl-10" editMode={editMode} />
            ))}
            {subfamily.groups.map((group) => (
              <GroupSection
                key={group.key}
                group={group}
                indentLevel="nested-group"
                editMode={editMode}
              />
            ))}
          </>
        )}
    </>
  );
}

function GroupSection({
  group,
  indentLevel,
  editMode,
}: {
  group: GroupRow;
  indentLevel: "group" | "nested-group";
  editMode: boolean;
}) {
  return (
    <>
      <tr className="bg-white text-slate-800">
        <td
          colSpan={7}
          className={`px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] ${
            indentLevel === "nested-group" ? "pl-14" : "pl-10"
          }`}
        >
          {group.wbs || "Sin WBS"}{group.name ? ` · ${group.name}` : ""}
        </td>
      </tr>
      {group.items.map((item) => (
        <ItemDataRow
          key={item.id}
          item={item}
          indent={indentLevel === "nested-group" ? "pl-16" : "pl-12"}
          editMode={editMode}
        />
      ))}
    </>
  );
}

function HierarchyToggleRow({
  level,
  wbs,
  name,
  collapsed,
  onToggle,
  itemCount,
}: {
  level: "family" | "subfamily";
  wbs: string | null;
  name: string | null;
  collapsed: boolean;
  onToggle: () => void;
  itemCount: number;
}) {
  const rowClass =
    level === "family" ? "bg-slate-100 text-slate-950" : "bg-slate-50 text-slate-900";
  const indentClass = level === "family" ? "" : "pl-6";

  return (
    <tr className={rowClass}>
      <td colSpan={7} className={`px-4 py-2 ${indentClass}`}>
        <button
          type="button"
          onClick={onToggle}
          className="flex w-full items-center justify-between gap-4 text-left"
        >
          <span className="text-xs font-semibold uppercase tracking-[0.16em]">
            {collapsed ? "▸" : "▾"} {wbs || "Sin WBS"}{name ? ` · ${name}` : ""}
          </span>
          <span className="rounded-full bg-white/80 px-3 py-1 text-[11px] font-medium tracking-normal text-slate-600">
            {itemCount} items
          </span>
        </button>
      </td>
    </tr>
  );
}

function ItemDataRow({
  item,
  indent,
  editMode,
}: {
  item: ItemRow;
  indent: string;
  editMode: boolean;
}) {
  return (
    <tr>
      <td className={`px-4 py-4 font-medium text-slate-900 ${indent}`}>
        <div className="flex items-center gap-2">
          <span>{item.itemNumber}</span>
          {editMode ? <TreeEditButton itemId={item.id} /> : null}
        </div>
      </td>
      <td className="px-4 py-4 text-slate-600">{item.description}</td>
      <td className="px-4 py-4 text-slate-600">{item.unit}</td>
      <td className="px-4 py-4 text-slate-600">{item.originalQuantity}</td>
      <td className="px-4 py-4 text-slate-600">{item.unitPrice}</td>
      <td className="px-4 py-4 text-slate-600">{item.originalAmount}</td>
      <td className="px-4 py-4 text-slate-600">
        {item.consumedQuantity} / {item.consumedAmount}
      </td>
    </tr>
  );
}

function TreeEditButton({ itemId }: { itemId: string }) {
  return (
    <button
      type="button"
      aria-label="Editar partida"
      title="Editar partida"
      onClick={() => {
        const url = new URL(window.location.href);
        url.searchParams.set("editMode", "1");
        url.searchParams.set("modal", "edit");
        url.searchParams.set("editItemId", itemId);
        window.location.assign(url.toString());
      }}
      className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-600 transition hover:border-slate-900 hover:text-slate-950"
    >
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-none stroke-current stroke-[2]">
        <path d="M4 20h4l10-10-4-4L4 16v4Z" />
        <path d="m12 6 4 4" />
      </svg>
    </button>
  );
}
