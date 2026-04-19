import type { Metadata } from "next";
import { manageUserAction } from "@/app/admin/users/actions";
import { AppShell } from "@/components/app-shell";
import { FlashBanner } from "@/components/flash-banner";
import { requireAdmin } from "@/lib/auth";
import { getUserAdminSnapshot } from "@/lib/contracts";

export const metadata: Metadata = {
  title: "Usuarios | Oficina Tecnica",
  description: "Administracion de usuarios y permisos.",
};

export const dynamic = "force-dynamic";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [user, users] = await Promise.all([requireAdmin(), getUserAdminSnapshot()]);
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const flashType = Array.isArray(resolvedSearchParams?.type)
    ? resolvedSearchParams?.type[0]
    : resolvedSearchParams?.type;
  const flashMessage = Array.isArray(resolvedSearchParams?.message)
    ? resolvedSearchParams?.message[0]
    : resolvedSearchParams?.message;

  return (
    <AppShell
      user={user}
      pathname="/admin/users"
      title="Usuarios y permisos"
      description="Aprueba solicitudes de acceso, crea cuentas directas en Supabase Auth y administra roles o bloqueos internos."
    >
      <FlashBanner type={flashType} message={flashMessage} />

      <section className="grid gap-6 xl:grid-cols-[0.72fr_1.28fr]">
        <article className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-[0_20px_50px_rgba(15,23,42,0.06)]">
          <div className="mb-6">
            <p className="text-sm font-medium text-teal-700">Accesos</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-950">
              Crear usuario inmediato
            </h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              Crea nuevas cuentas ya aprobadas en Supabase Auth y define si tendran perfil de administrador o solo visualizacion dentro de la app.
            </p>
          </div>

          <form action={manageUserAction} className="space-y-5">
            <input type="hidden" name="action" value="create" />
            <Field label="Nombre" name="name" placeholder="Nombre completo" />
            <Field label="Correo" name="email" placeholder="usuario@empresa.cl" />
            <Field label="Contrasena inicial" name="password" placeholder="Contrasena temporal" />
            <SelectField
              label="Rol"
              name="role"
              options={[
                { value: "VIEWER", label: "Visualizador" },
                { value: "ADMIN", label: "Administrador" },
              ]}
            />

            <button
              type="submit"
              className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Crear usuario
            </button>
          </form>
        </article>

        <article className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-[0_20px_50px_rgba(15,23,42,0.06)]">
          <div className="mb-6">
            <p className="text-sm font-medium text-teal-700">Accesos</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-950">
              Usuarios del sistema
            </h2>
          </div>

          <div className="space-y-4">
            {users.map((account) => (
              <div
                key={account.id}
                className="rounded-3xl border border-slate-200 bg-slate-50 p-5"
              >
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-semibold text-slate-950">{account.name}</p>
                    <p className="text-sm text-slate-600">{account.email}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full bg-white px-3 py-1 text-slate-600">
                      {account.role}
                    </span>
                    <span
                      className={`rounded-full px-3 py-1 ${
                        account.active
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-rose-100 text-rose-700"
                      }`}
                    >
                      {account.active ? "Activo" : "Inactivo"}
                    </span>
                    <span className="rounded-full bg-white px-3 py-1 text-slate-600">
                      {account.authUserId ? "Supabase vinculado" : "Pendiente de vincular"}
                    </span>
                    <span
                      className={`rounded-full px-3 py-1 ${
                        account.approvalStatus === "APPROVED"
                          ? "bg-emerald-100 text-emerald-700"
                          : account.approvalStatus === "REJECTED"
                            ? "bg-rose-100 text-rose-700"
                            : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {resolveApprovalStatusLabel(account.approvalStatus)}
                    </span>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 lg:grid-cols-4">
                  <form action={manageUserAction} className="rounded-2xl bg-white p-4">
                    <input type="hidden" name="action" value="update-approval-status" />
                    <input type="hidden" name="userId" value={account.id} />
                    <label className="block text-xs font-medium uppercase tracking-[0.15em] text-slate-400">
                      Solicitud
                    </label>
                    <select
                      name="approvalStatus"
                      defaultValue={account.approvalStatus}
                      className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0f766e] focus:ring-4 focus:ring-[#99f6e4]"
                    >
                      <option value="PENDING">Pendiente</option>
                      <option value="APPROVED">Aprobado</option>
                      <option value="REJECTED">Rechazado</option>
                    </select>
                    <button
                      type="submit"
                      className="mt-3 w-full rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-900 hover:text-slate-950"
                    >
                      Guardar solicitud
                    </button>
                  </form>

                  <form action={manageUserAction} className="rounded-2xl bg-white p-4">
                    <input type="hidden" name="action" value="update-role" />
                    <input type="hidden" name="userId" value={account.id} />
                    <label className="block text-xs font-medium uppercase tracking-[0.15em] text-slate-400">
                      Rol
                    </label>
                    <select
                      name="role"
                      defaultValue={account.role}
                      className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0f766e] focus:ring-4 focus:ring-[#99f6e4]"
                    >
                      <option value="VIEWER">Visualizador</option>
                      <option value="ADMIN">Administrador</option>
                    </select>
                    <button
                      type="submit"
                      className="mt-3 w-full rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-900 hover:text-slate-950"
                    >
                      Actualizar rol
                    </button>
                  </form>

                  <form action={manageUserAction} className="rounded-2xl bg-white p-4">
                    <input type="hidden" name="action" value="toggle-active" />
                    <input type="hidden" name="userId" value={account.id} />
                    <input
                      type="hidden"
                      name="active"
                      value={account.active ? "false" : "true"}
                    />
                    <label className="block text-xs font-medium uppercase tracking-[0.15em] text-slate-400">
                      Estado
                    </label>
                    <p className="mt-3 text-sm leading-7 text-slate-600">
                      {account.active
                        ? "Desactivar cuenta para bloquear su acceso a la app, aunque exista en Supabase Auth."
                        : "Reactivar cuenta para permitir ingreso nuevamente."}
                    </p>
                    <button
                      type="submit"
                      className="mt-3 w-full rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-900 hover:text-slate-950"
                    >
                      {account.active ? "Desactivar" : "Activar"}
                    </button>
                  </form>

                  <form action={manageUserAction} className="rounded-2xl bg-white p-4">
                    <input type="hidden" name="action" value="reset-password" />
                    <input type="hidden" name="userId" value={account.id} />
                    <label className="block text-xs font-medium uppercase tracking-[0.15em] text-slate-400">
                      Nueva contrasena
                    </label>
                    <input
                      name="password"
                      type="password"
                      placeholder="Nueva contrasena"
                      className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0f766e] focus:ring-4 focus:ring-[#99f6e4]"
                    />
                    <button
                      type="submit"
                      className="mt-3 w-full rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-900 hover:text-slate-950"
                    >
                      Actualizar clave en Supabase
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>
    </AppShell>
  );
}

function resolveApprovalStatusLabel(status: "PENDING" | "APPROVED" | "REJECTED") {
  if (status === "APPROVED") {
    return "Aprobado";
  }

  if (status === "REJECTED") {
    return "Rechazado";
  }

  return "Pendiente";
}

function Field(props: {
  label: string;
  name: string;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-700" htmlFor={props.name}>
        {props.label}
      </label>
      <input
        id={props.name}
        name={props.name}
        placeholder={props.placeholder}
        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0f766e] focus:ring-4 focus:ring-[#99f6e4]"
      />
    </div>
  );
}

function SelectField(props: {
  label: string;
  name: string;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-700" htmlFor={props.name}>
        {props.label}
      </label>
      <select
        id={props.name}
        name={props.name}
        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0f766e] focus:ring-4 focus:ring-[#99f6e4]"
      >
        {props.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
