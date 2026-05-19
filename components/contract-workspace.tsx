import Link from "next/link";
import type { ReactNode } from "react";
import { ContractNav } from "@/components/contract-nav";

type ContractTabKey = "overview" | "items" | "taxonomy" | "closures" | "changes";

export function ContractShell({
  contractId,
  active,
  userRole,
  header,
  actions,
  children,
}: {
  contractId: string;
  active: ContractTabKey;
  userRole?: Parameters<typeof ContractNav>[0]["userRole"];
  header: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-[0_14px_40px_rgba(15,23,42,0.05)] md:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 flex-1">{header}</div>
          {actions ? <ContractActionBar>{actions}</ContractActionBar> : null}
        </div>
        <div className="mt-4 border-t border-slate-100 pt-4">
          <ContractNav contractId={contractId} active={active} userRole={userRole} />
        </div>
      </div>
      {children}
    </section>
  );
}

export function ContractHeader({
  code,
  name,
  clientName,
  status,
  meta,
}: {
  code: string;
  name: string;
  clientName: string;
  status: string;
  meta?: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-teal-700">
          {code}
        </span>
        <StatusBadge label={status} tone="slate" />
      </div>
      <h2 className="mt-2 truncate text-2xl font-semibold tracking-tight text-slate-950 md:text-3xl">
        {name}
      </h2>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600">
        <span>{clientName}</span>
        {meta}
      </div>
    </div>
  );
}

export function ContractKpiStrip({
  items,
}: {
  items: Array<{
    label: string;
    value: string | number;
    helper?: string;
    tone?: "slate" | "teal" | "sky" | "amber";
  }>;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <MetricCard
          key={item.label}
          label={item.label}
          value={item.value}
          helper={item.helper}
          tone={item.tone}
        />
      ))}
    </div>
  );
}

export function ContractActionBar({ children }: { children: ReactNode }) {
  return <div className="flex shrink-0 flex-wrap gap-2 xl:justify-end">{children}</div>;
}

export function StatusBadge({
  label,
  tone = "slate",
}: {
  label: string;
  tone?: "slate" | "teal" | "sky" | "amber" | "rose";
}) {
  const toneClass = {
    slate: "border-slate-200 bg-slate-50 text-slate-700",
    teal: "border-teal-100 bg-teal-50 text-teal-800",
    sky: "border-sky-100 bg-sky-50 text-sky-800",
    amber: "border-amber-100 bg-amber-50 text-amber-800",
    rose: "border-rose-100 bg-rose-50 text-rose-800",
  }[tone];

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${toneClass}`}>
      {label}
    </span>
  );
}

export function EmptyState({
  title,
  text,
  action,
}: {
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-[1.25rem] border border-dashed border-slate-300 bg-slate-50/80 p-5 text-sm text-slate-600">
      <p className="font-semibold text-slate-950">{title}</p>
      <p className="mt-1 leading-6">{text}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function MetricCard({
  label,
  value,
  helper,
  tone = "slate",
}: {
  label: string;
  value: string | number;
  helper?: string;
  tone?: "slate" | "teal" | "sky" | "amber";
}) {
  const accentClass = {
    slate: "border-slate-200 bg-white",
    teal: "border-teal-100 bg-teal-50/45",
    sky: "border-sky-100 bg-sky-50/45",
    amber: "border-amber-100 bg-amber-50/45",
  }[tone];

  return (
    <article className={`rounded-[1.25rem] border p-4 ${accentClass}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
        {value}
      </p>
      {helper ? <p className="mt-1 text-xs leading-5 text-slate-500">{helper}</p> : null}
    </article>
  );
}

export function TextLinkButton({
  href,
  children,
  variant = "primary",
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary" | "disabled";
}) {
  if (variant === "disabled") {
    return (
      <span className="cursor-not-allowed rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-400">
        {children}
      </span>
    );
  }

  const className =
    variant === "primary"
      ? "rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
      : "rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-900 hover:text-slate-950";

  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
