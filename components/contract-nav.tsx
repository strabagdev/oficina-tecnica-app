import Link from "next/link";
import { UserRole } from "@prisma/client";

const items = [
  { key: "overview", label: "Resumen", adminOnly: false },
  { key: "items", label: "Itemizado", adminOnly: false },
  { key: "closures", label: "EDP", adminOnly: false },
  { key: "changes", label: "NOC", adminOnly: false },
  { key: "forecast", label: "Forecast", adminOnly: false },
  { key: "taxonomy", label: "Jerarquia", adminOnly: true },
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
    forecast: `/contracts/${contractId}/forecast`,
  } as const;

  return (
    <nav className="flex flex-nowrap gap-1 overflow-x-auto rounded-full bg-slate-100 p-1">
      {items
        .filter((item) => !item.adminOnly || userRole === UserRole.ADMIN)
        .map((item) => {
        const isActive = item.key === active;

        return (
          <Link
            key={item.key}
            href={hrefByKey[item.key]}
            className={`whitespace-nowrap rounded-full px-3 py-2 text-sm font-medium transition ${
              isActive
                ? "bg-white text-slate-950 shadow-sm"
                : "text-slate-600 hover:bg-white/70 hover:text-slate-950"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
