"use client";

import { useEffect, useMemo, useState } from "react";

type FamilyOption = {
  id: string;
  name: string;
  wbs?: string | null;
};

type SubfamilyOption = {
  id: string;
  familyId: string;
  name: string;
  familyName: string;
  wbs?: string | null;
};

type GroupOption = {
  id: string;
  familyId: string;
  subfamilyId: string;
  name: string;
  subfamilyName: string;
  wbs?: string | null;
};

export function ItemTaxonomyFields({
  families,
  subfamilies,
  groups,
  defaultFamilyId = "",
  defaultSubfamilyId = "",
  defaultGroupId = "",
  idPrefix,
}: {
  families: FamilyOption[];
  subfamilies: SubfamilyOption[];
  groups: GroupOption[];
  defaultFamilyId?: string;
  defaultSubfamilyId?: string;
  defaultGroupId?: string;
  idPrefix: string;
}) {
  const [familyId, setFamilyId] = useState(defaultFamilyId);
  const [subfamilyId, setSubfamilyId] = useState(defaultSubfamilyId);
  const [groupId, setGroupId] = useState(defaultGroupId);

  const availableSubfamilies = useMemo(
    () => subfamilies.filter((subfamily) => subfamily.familyId === familyId),
    [familyId, subfamilies],
  );
  const availableGroups = useMemo(
    () => groups.filter((group) => group.subfamilyId === subfamilyId),
    [groupId, groups, subfamilyId],
  );

  useEffect(() => {
    if (subfamilyId && !availableSubfamilies.some((subfamily) => subfamily.id === subfamilyId)) {
      setSubfamilyId("");
      setGroupId("");
    }
  }, [availableSubfamilies, subfamilyId]);

  useEffect(() => {
    if (groupId && !availableGroups.some((group) => group.id === groupId)) {
      setGroupId("");
    }
  }, [availableGroups, groupId]);

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <div className="space-y-2">
        <label className="block text-sm font-medium text-slate-700" htmlFor={`${idPrefix}-family`}>
          Familia
        </label>
        <select
          id={`${idPrefix}-family`}
          name="familyId"
          value={familyId}
          onChange={(event) => {
            setFamilyId(event.target.value);
            setSubfamilyId("");
            setGroupId("");
          }}
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0f766e] focus:ring-4 focus:ring-[#99f6e4]"
        >
          <option value="">Selecciona familia</option>
          {families.map((family) => (
          <option key={family.id} value={family.id}>
              {family.wbs ? `${family.wbs} · ` : ""}
              {family.name}
          </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-slate-700" htmlFor={`${idPrefix}-subfamily`}>
          Subfamilia opcional
        </label>
        <select
          id={`${idPrefix}-subfamily`}
          name="subfamilyId"
          value={subfamilyId}
          onChange={(event) => {
            setSubfamilyId(event.target.value);
            setGroupId("");
          }}
          disabled={!familyId}
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition disabled:cursor-not-allowed disabled:bg-slate-50 focus:border-[#0f766e] focus:ring-4 focus:ring-[#99f6e4]"
        >
          <option value="">Sin subfamilia</option>
          {availableSubfamilies.map((subfamily) => (
          <option key={subfamily.id} value={subfamily.id}>
              {subfamily.wbs ? `${subfamily.wbs} · ` : ""}
              {subfamily.name}
          </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-slate-700" htmlFor={`${idPrefix}-group`}>
          Grupo opcional
        </label>
        <select
          id={`${idPrefix}-group`}
          name="groupId"
          value={groupId}
          onChange={(event) => setGroupId(event.target.value)}
          disabled={!subfamilyId}
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition disabled:cursor-not-allowed disabled:bg-slate-50 focus:border-[#0f766e] focus:ring-4 focus:ring-[#99f6e4]"
        >
          <option value="">Sin grupo</option>
          {availableGroups.map((group) => (
          <option key={group.id} value={group.id}>
              {group.wbs ? `${group.wbs} · ` : ""}
              {group.name}
          </option>
          ))}
        </select>
      </div>
    </div>
  );
}
