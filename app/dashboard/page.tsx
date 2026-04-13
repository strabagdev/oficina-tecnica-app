import type { Metadata } from "next";
import { UserRole } from "@prisma/client";
import { logoutAction } from "@/app/actions/auth";
import { requireUser } from "@/lib/auth";
import { getDashboardSnapshot } from "@/lib/dashboard";

export const metadata: Metadata = {
  title: "Panel | Oficina Tecnica",
  description: "Resumen inicial del control contractual.",
};

export const dynamic = "force-dynamic";

const roleLabels = {
  [UserRole.ADMIN]: "Administrador",
  [UserRole.VIEWER]: "Visualizador",
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [user, snapshot] = await Promise.all([
    requireUser(),
    getDashboardSnapshot(),
  ]);
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const flashType = Array.isArray(resolvedSearchParams?.type)
    ? resolvedSearchParams?.type[0]
    : resolvedSearchParams?.type;
  const flashMessage = Array.isArray(resolvedSearchParams?.message)
    ? resolvedSearchParams?.message[0]
    : resolvedSearchParams?.message;

  return (
    <main className="min-h-screen bg-[#f6f8f7] px-6 py-8 text-slate-900">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
        <header className="flex flex-col gap-4 rounded-[2rem] bg-slate-950 px-8 py-7 text-white shadow-[0_28px_80px_rgba(15,23,42,0.25)] lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <p className="text-sm uppercase tracking-[0.3em] text-teal-200">
              Control contractual
            </p>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
                Bienvenido, {user.name}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-300">
                Perfil activo: {roleLabels[user.role]}. Esta base ya contempla
                contratos, itemizados, consumos, cierres mensuales y cambios NOC
                para seguir construyendo el flujo completo.
              </p>
            </div>
          </div>

          <form action={logoutAction}>
            <button
              type="submit"
              className="rounded-full border border-white/20 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/10"
            >
              Cerrar sesion
            </button>
          </form>
        </header>

        {flashMessage ? (
          <div
            className={`rounded-[1.5rem] border px-5 py-4 text-sm ${
              flashType === "error"
                ? "border-rose-200 bg-rose-50 text-rose-700"
                : "border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}
          >
            {flashMessage}
          </div>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Contratos" value={snapshot.contracts} />
          <MetricCard label="Items cargados" value={snapshot.items} />
          <MetricCard label="Consumos mensuales" value={snapshot.consumptions} />
          <MetricCard label="Cierres mensuales" value={snapshot.closures} />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
          <article className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-[0_20px_50px_rgba(15,23,42,0.06)]">
            <div className="flex flex-col gap-2 border-b border-slate-100 pb-5">
              <p className="text-sm font-medium text-teal-700">Contrato de referencia</p>
              <h2 className="text-2xl font-semibold text-slate-950">
                {snapshot.sampleContract.name}
              </h2>
              <p className="text-sm leading-6 text-slate-600">
                {snapshot.sampleContract.code} · {snapshot.sampleContract.clientName}
              </p>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <DataPill label="Moneda" value={snapshot.sampleContract.currency} />
              <DataPill
                label="Monto original"
                value={snapshot.sampleContract.originalAmount}
              />
              <DataPill
                label="Etapa"
                value={snapshot.contracts > 0 ? "Con datos reales" : "Demo inicial"}
              />
            </div>

            <div className="mt-8 overflow-hidden rounded-3xl border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Item</th>
                    <th className="px-4 py-3 font-medium">Descripcion</th>
                    <th className="px-4 py-3 font-medium">Unidad</th>
                    <th className="px-4 py-3 font-medium">Presupuesto</th>
                    <th className="px-4 py-3 font-medium">Descuento</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {snapshot.sampleContract.sampleItems.map((item) => (
                    <tr key={item.itemCode}>
                      <td className="px-4 py-4 font-medium text-slate-900">
                        {item.itemCode}
                      </td>
                      <td className="px-4 py-4 text-slate-600">
                        {item.description}
                      </td>
                      <td className="px-4 py-4 text-slate-600">{item.unit}</td>
                      <td className="px-4 py-4 text-slate-600">{item.budget}</td>
                      <td className="px-4 py-4 text-slate-600">
                        {item.discountMode}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-4">
              <DataPill
                label="Ultimo cierre"
                value={snapshot.sampleContract.lastClosure.period}
              />
              <DataPill
                label="Estado de pago"
                value={snapshot.sampleContract.lastClosure.statementNumber}
              />
              <DataPill
                label="Bruto / descuentos"
                value={`${snapshot.sampleContract.lastClosure.grossAmount} / ${snapshot.sampleContract.lastClosure.discounts}`}
              />
              <DataPill
                label="Neto a pagar"
                value={snapshot.sampleContract.lastClosure.netAmount}
              />
            </div>
          </article>

          <aside className="space-y-6">
            <article className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-[0_20px_50px_rgba(15,23,42,0.06)]">
              <h2 className="text-xl font-semibold text-slate-950">
                Alcance de esta base
              </h2>
              <ul className="mt-4 space-y-3 text-sm leading-7 text-slate-600">
                <li>Login por credenciales con roles `ADMIN` y `VIEWER`.</li>
                <li>Sesion persistente con cookie segura y tabla de sesiones.</li>
                <li>Modelo para contratos, itemizados, consumos, cierres y NOC.</li>
                <li>Descuentos mensuales por porcentaje o por cantidad del item.</li>
              </ul>
            </article>

            <article className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-[0_20px_50px_rgba(15,23,42,0.06)]">
              <h2 className="text-xl font-semibold text-slate-950">Cierre mensual</h2>
              <p className="mt-4 text-sm leading-7 text-slate-600">
                Cada estado de pago guarda una foto del itemizado al cierre del
                mes: avance, descuento aplicado y neto pagable por item.
              </p>
              <ul className="mt-4 space-y-3 text-sm leading-7 text-slate-600">
                {snapshot.sampleContract.discountRules.map((rule) => (
                  <li key={rule}>{rule}</li>
                ))}
              </ul>
              <div className="mt-5 rounded-3xl bg-teal-50 p-4 text-sm leading-7 text-teal-900">
                {user.role === UserRole.ADMIN
                  ? "Tu perfil administrador puede crear contratos y registrar cierres."
                  : "Tu perfil visualizador queda orientado a consulta de avances y estados de pago."}
              </div>
            </article>

            <article className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-[0_20px_50px_rgba(15,23,42,0.06)]">
              <h2 className="text-xl font-semibold text-slate-950">NOC pendientes</h2>
              <p className="mt-4 text-4xl font-semibold tracking-tight text-slate-950">
                {snapshot.pendingChanges}
              </p>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                Cambios contractuales aun no incorporados en el cierre oficial.
              </p>
            </article>
          </aside>
        </section>

        {user.role === UserRole.ADMIN ? (
          <section className="grid gap-6 xl:grid-cols-2">
            <article className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-[0_20px_50px_rgba(15,23,42,0.06)]">
              <div className="mb-6">
                <p className="text-sm font-medium text-teal-700">Administracion</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-950">
                  Crear contrato con itemizado
                </h2>
                <p className="mt-2 text-sm leading-7 text-slate-600">
                  Carga rapida para partir con contratos reales y dejar preparado
                  el consumo mensual.
                </p>
              </div>
              <form action="/api/contracts" method="post" className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Codigo" name="code" placeholder="CT-2026-001" />
                  <Field
                    label="Mandante"
                    name="clientName"
                    placeholder="MOP / Municipalidad / Cliente"
                  />
                </div>

                <Field
                  label="Nombre del contrato"
                  name="name"
                  placeholder="Conservacion vial..."
                />

                <div className="grid gap-4 md:grid-cols-3">
                  <Field label="Moneda" name="currency" placeholder="CLP" defaultValue="CLP" />
                  <SelectField
                    label="Estado"
                    name="status"
                    options={[
                      { value: "DRAFT", label: "Borrador" },
                      { value: "ACTIVE", label: "Activo" },
                      { value: "ON_HOLD", label: "En pausa" },
                      { value: "CLOSED", label: "Cerrado" },
                    ]}
                  />
                  <Field label="Descripcion" name="description" placeholder="Opcional" />
                </div>

                <div className="space-y-2">
                  <label
                    className="block text-sm font-medium text-slate-700"
                    htmlFor="items"
                  >
                    Itemizado rapido
                  </label>
                  <textarea
                    id="items"
                    name="items"
                    required
                    rows={8}
                    placeholder="1.1|Movimiento de tierras|m3|1200|18500&#10;2.4|Base granular|m2|3500|24285"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0f766e] focus:ring-4 focus:ring-[#99f6e4]"
                  />
                  <p className="text-xs leading-6 text-slate-500">
                    Formato por linea: <code>codigo|descripcion|unidad|cantidad|precioUnitario</code>
                  </p>
                </div>

                <button
                  type="submit"
                  className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Crear contrato
                </button>
              </form>
            </article>

            <article className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-[0_20px_50px_rgba(15,23,42,0.06)]">
              <div className="mb-6">
                <p className="text-sm font-medium text-teal-700">Estados de pago</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-950">
                  Registrar cierre mensual
                </h2>
                <p className="mt-2 text-sm leading-7 text-slate-600">
                  El cierre guarda consumo bruto, descuentos y snapshot del
                  itemizado al momento del estado de pago.
                </p>
              </div>
              <form action="/api/monthly-closures" method="post" className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label
                      className="block text-sm font-medium text-slate-700"
                      htmlFor="contractId"
                    >
                      Contrato
                    </label>
                    <select
                      id="contractId"
                      name="contractId"
                      required
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0f766e] focus:ring-4 focus:ring-[#99f6e4]"
                    >
                      <option value="">Selecciona un contrato</option>
                      {snapshot.contractOptions.map((contract) => (
                        <option key={contract.id} value={contract.id}>
                          {contract.code} · {contract.name} ({contract.itemCount} items)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3">
                    <Field label="Ano" name="year" placeholder="2026" />
                    <Field label="Mes" name="month" placeholder="3" />
                    <Field label="EP" name="statementNumber" placeholder="EP-03" />
                  </div>
                </div>

                <Field
                  label="Resumen"
                  name="summaryNote"
                  placeholder="Observaciones generales del estado de pago"
                />

                <div className="space-y-2">
                  <label
                    className="block text-sm font-medium text-slate-700"
                    htmlFor="rows"
                  >
                    Lineas del cierre
                  </label>
                  <textarea
                    id="rows"
                    name="rows"
                    required
                    rows={8}
                    placeholder="1.1|180|QUANTITY|20|Descuento por reparacion&#10;2.4|950|PERCENTAGE|5|Retencion parcial&#10;5.2|1|NONE|0|"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0f766e] focus:ring-4 focus:ring-[#99f6e4]"
                  />
                  <p className="text-xs leading-6 text-slate-500">
                    Formato por linea: <code>codigo|cantidadMes|modoDescuento|valorDescuento|nota</code>.
                    Modos permitidos: <code>NONE</code>, <code>PERCENTAGE</code>, <code>QUANTITY</code>.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={snapshot.contractOptions.length === 0}
                  className="rounded-full bg-[#0f766e] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#115e59] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  Generar cierre mensual
                </button>
              </form>
            </article>
          </section>
        ) : null}

        <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <article className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-[0_20px_50px_rgba(15,23,42,0.06)]">
            <h2 className="text-2xl font-semibold text-slate-950">
              Contratos cargados
            </h2>
            <div className="mt-6 space-y-4">
              {snapshot.contractOptions.length > 0 ? (
                snapshot.contractOptions.map((contract) => (
                  <div
                    key={contract.id}
                    className="rounded-3xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="font-semibold text-slate-950">
                          {contract.code} · {contract.name}
                        </p>
                        <p className="text-sm text-slate-600">{contract.clientName}</p>
                      </div>
                      <p className="text-sm text-slate-500">{contract.status}</p>
                    </div>
                    <p className="mt-3 text-sm leading-7 text-slate-600">
                      {contract.itemCount} items cargados · {contract.closureCount} cierres registrados
                    </p>
                  </div>
                ))
              ) : (
                <EmptyState text="Todavia no hay contratos cargados." />
              )}
            </div>
          </article>

          <article className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-[0_20px_50px_rgba(15,23,42,0.06)]">
            <h2 className="text-2xl font-semibold text-slate-950">
              Ultimos cierres
            </h2>
            <div className="mt-6 space-y-5">
              {snapshot.recentClosures.length > 0 ? (
                snapshot.recentClosures.map((closure) => (
                  <div
                    key={closure.id}
                    className="rounded-3xl border border-slate-200 bg-slate-50 p-5"
                  >
                    <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="font-semibold text-slate-950">
                          {closure.contractLabel}
                        </p>
                        <p className="text-sm text-slate-600">
                          {closure.periodLabel} · {closure.statementNumber}
                        </p>
                      </div>
                      <p className="text-sm font-medium text-slate-700">
                        Neto {closure.netAmount}
                      </p>
                    </div>
                    <p className="mt-3 text-sm text-slate-600">
                      Bruto {closure.grossAmount} · Descuentos {closure.totalDiscounts}
                    </p>
                    <div className="mt-4 overflow-hidden rounded-3xl border border-slate-200 bg-white">
                      <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                        <thead className="bg-slate-50 text-slate-500">
                          <tr>
                            <th className="px-4 py-3 font-medium">Item</th>
                            <th className="px-4 py-3 font-medium">Cantidad</th>
                            <th className="px-4 py-3 font-medium">Descuento</th>
                            <th className="px-4 py-3 font-medium">Neto</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {closure.entries.map((entry) => (
                            <tr key={`${closure.id}-${entry.itemCode}`}>
                              <td className="px-4 py-4 text-slate-700">
                                <span className="font-medium text-slate-900">
                                  {entry.itemCode}
                                </span>{" "}
                                · {entry.description}
                              </td>
                              <td className="px-4 py-4 text-slate-600">
                                {entry.quantityConsumed} {entry.unit ?? ""}
                              </td>
                              <td className="px-4 py-4 text-slate-600">
                                {entry.discountDisplay}
                              </td>
                              <td className="px-4 py-4 text-slate-600">
                                {entry.netAmount}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState text="Todavia no hay cierres registrados." />
              )}
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <article className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">
        {value}
      </p>
    </article>
  );
}

function DataPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl bg-slate-50 p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <p className="mt-2 text-lg font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm leading-7 text-slate-500">
      {text}
    </div>
  );
}

function Field(props: {
  label: string;
  name: string;
  placeholder?: string;
  defaultValue?: string;
}) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-700" htmlFor={props.name}>
        {props.label}
      </label>
      <input
        id={props.name}
        name={props.name}
        defaultValue={props.defaultValue}
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
