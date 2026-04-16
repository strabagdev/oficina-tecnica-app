import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ContractNav } from "@/components/contract-nav";
import { ContractTaxonomyManager } from "@/components/contract-taxonomy-manager";
import { FlashBanner } from "@/components/flash-banner";
import { requireAdmin } from "@/lib/auth";
import { getContractDetailSnapshot } from "@/lib/contracts";
import { getItemTaxonomySnapshot } from "@/lib/item-taxonomy";

export const metadata: Metadata = {
  title: "Jerarquia del contrato | Oficina Tecnica",
  description: "Administracion de WBS, familias, subfamilias y grupos por contrato.",
};

export const dynamic = "force-dynamic";

export default async function ContractTaxonomyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireAdmin();
  const { id } = await params;
  const [contract, families] = await Promise.all([
    getContractDetailSnapshot(id),
    getItemTaxonomySnapshot(id),
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
      pathname={`/contracts/${id}/taxonomy`}
      title={`Jerarquia · ${contract.code}`}
      description="Administra la estructura WBS propia de este contrato, sin mezclarla con otros proyectos."
      actions={
        <Link
          href={`/contracts/${id}/items`}
          className="rounded-full bg-white px-5 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-slate-100"
        >
          Volver a partidas
        </Link>
      }
    >
      <ContractNav contractId={id} active="taxonomy" userRole={user.role} />
      <FlashBanner type={flashType} message={flashMessage} />

      <section className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-[0_20px_50px_rgba(15,23,42,0.06)]">
        <h2 className="text-2xl font-semibold text-slate-950">Jerarquia del contrato</h2>
        <p className="mt-2 max-w-4xl text-sm leading-7 text-slate-600">
          Esta estructura pertenece a <span className="font-semibold text-slate-900">{contract.code}</span>. Las partidas de este contrato solo usaran la jerarquia creada aqui.
        </p>
      </section>

      <ContractTaxonomyManager
        families={families}
        redirectTo={`/contracts/${id}/taxonomy`}
        contractId={id}
      />
    </AppShell>
  );
}
