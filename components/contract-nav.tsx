import Link from "next/link";
import { UserRole } from "@prisma/client";

const items = [
  { key: "overview", label: "Resumen", adminOnly: false },
  { key: "items", label: "Partidas", adminOnly: false },
  { key: "taxonomy", label: "Jerarquia", adminOnly: true },
  { key: "closures", label: "Cierres", adminOnly: false },
  { key: "changes", label: "NOC", adminOnly: false },
] as const;

export function ContractNav({
  contractId,
  active,
  userRole,
}: {
  contractId: string;
  active: (typeof items)[number]["key"];
  userRole?: UserRole;
}) {
  const hrefByKey = {
    overview: `/contracts/${contractId}`,
    items: `/contracts/${contractId}/items`,
    taxonomy: `/contracts/${contractId}/taxonomy`,
    closures: `/contracts/${contractId}/closures`,
    changes: `/contracts/${contractId}/changes`,
  } as const;

  return (
    <nav className="flex flex-wrap gap-3">
      {items
        .filter((item) => !item.adminOnly || userRole === UserRole.ADMIN)
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
