import Link from "next/link";

const items = [
  { key: "overview", label: "Resumen" },
  { key: "items", label: "Partidas" },
  { key: "items-admin", label: "Admin itemizado" },
  { key: "closures", label: "Cierres" },
  { key: "changes", label: "NOC" },
] as const;

export function ContractNav({
  contractId,
  active,
  showItemAdmin = false,
}: {
  contractId: string;
  active: (typeof items)[number]["key"];
  showItemAdmin?: boolean;
}) {
  const hrefByKey = {
    overview: `/contracts/${contractId}`,
    items: `/contracts/${contractId}/items`,
    "items-admin": `/contracts/${contractId}/items/admin`,
    closures: `/contracts/${contractId}/closures`,
    changes: `/contracts/${contractId}/changes`,
  } as const;

  return (
    <nav className="flex flex-wrap gap-3">
      {items
        .filter((item) => (item.key === "items-admin" ? showItemAdmin : true))
        .map((item) => {
        const isActive = item.key === active;

        return (
          <Link
            key={item.key}
            href={hrefByKey[item.key]}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              isActive
                ? "bg-slate-950 text-white"
                : "border border-slate-300 bg-white text-slate-700 hover:border-slate-900 hover:text-slate-950"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
