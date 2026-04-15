import Link from "next/link";

const items = [
  { key: "overview", label: "Resumen" },
  { key: "items", label: "Partidas" },
  { key: "closures", label: "Cierres" },
  { key: "changes", label: "NOC" },
] as const;

export function ContractNav({
  contractId,
  active,
}: {
  contractId: string;
  active: (typeof items)[number]["key"];
}) {
  const hrefByKey = {
    overview: `/contracts/${contractId}`,
    items: `/contracts/${contractId}/items`,
    closures: `/contracts/${contractId}/closures`,
    changes: `/contracts/${contractId}/changes`,
  } as const;

  return (
    <nav className="flex flex-wrap gap-3">
      {items.map((item) => {
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
