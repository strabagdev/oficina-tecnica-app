import Link from "next/link";
import { UserRole } from "@prisma/client";
import { logoutAction } from "@/app/actions/auth";
import type { AuthUser } from "@/lib/auth";

const navigation = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/contracts", label: "Contratos" },
  { href: "/admin/users", label: "Usuarios", adminOnly: true },
];

export function AppShell({
  user,
  title,
  description,
  pathname,
  children,
  actions,
}: {
  user: AuthUser;
  title: string;
  description: string;
  pathname: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[#f6f8f7] text-slate-900">
      <div className="mx-auto flex min-h-screen w-full max-w-[1760px] flex-col gap-5 px-4 py-4 md:px-5 xl:px-6">
        <header className="rounded-[2rem] bg-slate-950 px-6 py-5 text-white shadow-[0_28px_80px_rgba(15,23,42,0.25)] md:px-7 md:py-6">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-2.5">
              <p className="text-sm uppercase tracking-[0.3em] text-teal-200">
                Oficina tecnica contractual
              </p>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
                  {title}
                </h1>
                <p className="mt-1.5 max-w-4xl text-sm leading-6 text-slate-300">
                  {description}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              <div className="flex flex-wrap gap-2">
                {navigation
                  .filter((item) => !item.adminOnly || user.role === UserRole.ADMIN)
                  .map((item) => {
                    const isActive =
                      pathname === item.href ||
                      (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`rounded-full px-4 py-2 text-sm font-medium leading-none transition ${
                          isActive
                            ? "bg-white text-slate-950"
                            : "border border-white/15 text-white hover:bg-white/10"
                        }`}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
              </div>

              <div className="flex flex-wrap items-center justify-end gap-3">
                {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
                <span className="shrink-0 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium leading-none text-white whitespace-nowrap">
                  {user.name || user.email}
                </span>
                <form action={logoutAction} className="shrink-0">
                  <button
                    type="submit"
                    className="whitespace-nowrap rounded-full border border-white/20 px-5 py-2.5 text-sm font-medium leading-none text-white transition hover:bg-white/10"
                  >
                    Cerrar sesion
                  </button>
                </form>
              </div>
            </div>
          </div>
        </header>

        {children}
      </div>
    </main>
  );
}
