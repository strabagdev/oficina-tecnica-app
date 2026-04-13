import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { getCurrentUser, getLoginSetup } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Ingreso | Oficina Tecnica",
  description: "Acceso para administradores y usuarios visualizadores.",
};

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const [user, setup] = await Promise.all([getCurrentUser(), getLoginSetup()]);

  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#ccfbf1,transparent_30%),linear-gradient(180deg,#f8fafc_0%,#ecfeff_100%)] px-6 py-10 text-slate-900">
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] w-full max-w-6xl gap-10 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="flex flex-col justify-between rounded-[2rem] border border-white/70 bg-white/75 p-8 shadow-[0_30px_80px_rgba(15,23,42,0.08)] backdrop-blur md:p-10">
          <div className="space-y-8">
            <span className="inline-flex rounded-full bg-slate-900 px-4 py-1 text-sm font-medium text-white">
              Oficina Tecnica Contractual
            </span>
            <div className="space-y-5">
              <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-slate-950 md:text-6xl">
                Controla itemizados, consumos mensuales y cambios NOC desde una
                sola base.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-slate-600">
                Esta primera version deja listo el acceso con perfiles simples y
                una estructura pensada para registrar contratos, avances mensuales
                y modificaciones de cantidades o montos.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <article className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm font-medium text-slate-500">Base contractual</p>
              <p className="mt-3 text-sm leading-7 text-slate-700">
                Contrato, cliente, plazo, monto original y su itemizado base.
              </p>
            </article>
            <article className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm font-medium text-slate-500">Consumo mensual</p>
              <p className="mt-3 text-sm leading-7 text-slate-700">
                Registro por item, mes y ano para comparar presupuesto contra
                ejecucion.
              </p>
            </article>
            <article className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm font-medium text-slate-500">Cambios NOC</p>
              <p className="mt-3 text-sm leading-7 text-slate-700">
                Ajustes de cantidades y montos con fecha efectiva y estado.
              </p>
            </article>
          </div>
        </section>

        <section className="flex items-center">
          <div className="w-full rounded-[2rem] border border-slate-200 bg-white p-8 shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
            <div className="mb-8 space-y-2">
              <h2 className="text-2xl font-semibold text-slate-950">Ingresar</h2>
              <p className="text-sm leading-6 text-slate-600">
                Acceso simple con dos perfiles iniciales: administrador y
                visualizador.
              </p>
            </div>

            <LoginForm />

            <div className="mt-8 space-y-4 rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
              <p className="font-medium text-slate-800">
                {setup.hasConfiguredUsers
                  ? "Usuarios definidos por variables de entorno."
                  : "Modo de inicio rapido local."}
              </p>
              {setup.demoUsers.length > 0 ? (
                <ul className="space-y-2">
                  {setup.demoUsers.map((account) => (
                    <li key={account.email}>
                      {account.role}: <strong>{account.email}</strong> /{" "}
                      <strong>{account.password}</strong>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>
                  En produccion define `ADMIN_EMAIL`, `ADMIN_PASSWORD`,
                  `VIEWER_EMAIL` y `VIEWER_PASSWORD` antes del primer ingreso.
                </p>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
