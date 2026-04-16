type FamilySnapshot = {
  id: string;
  name: string;
  wbs: string | null;
  active: boolean;
  subfamilies: {
    id: string;
    name: string;
    wbs: string | null;
    active: boolean;
    groups: {
      id: string;
      name: string;
      wbs: string | null;
      active: boolean;
    }[];
  }[];
};

export function ContractTaxonomyManager({
  families,
  redirectTo,
  contractId,
}: {
  families: FamilySnapshot[];
  redirectTo: string;
  contractId?: string;
}) {
  const subfamilies = families.flatMap((family) =>
    family.subfamilies.map((subfamily) => ({
      id: subfamily.id,
      familyName: family.name,
      name: subfamily.name,
      wbs: subfamily.wbs,
    })),
  );

  return (
    <>
      <section className="grid gap-6 xl:grid-cols-3">
        <CreateCard
          title="Crear familia"
          description="Primer nivel de organizacion del itemizado."
        >
          <form action="/api/item-taxonomy" method="post" className="space-y-4">
            <input type="hidden" name="action" value="create-family" />
            <input type="hidden" name="redirectTo" value={redirectTo} />
            {contractId ? <input type="hidden" name="contractId" value={contractId} /> : null}
            <Field label="Nombre" name="name" placeholder="Movimiento de tierras" />
            <Field label="WBS" name="wbs" placeholder="1" />
            <SubmitButton text="Crear familia" />
          </form>
        </CreateCard>

        <CreateCard
          title="Crear subfamilia"
          description="Segundo nivel, dependiente de una familia."
        >
          <form action="/api/item-taxonomy" method="post" className="space-y-4">
            <input type="hidden" name="action" value="create-subfamily" />
            <input type="hidden" name="redirectTo" value={redirectTo} />
            {contractId ? <input type="hidden" name="contractId" value={contractId} /> : null}
            <SelectField
              label="Familia"
              name="familyId"
              options={families.map((family) => ({
                value: family.id,
                label: `${family.wbs ? `${family.wbs} · ` : ""}${family.name}`,
              }))}
            />
            <Field label="Nombre" name="name" placeholder="Excavaciones" />
            <Field label="WBS" name="wbs" placeholder="1.1" />
            <SubmitButton text="Crear subfamilia" />
          </form>
        </CreateCard>

        <CreateCard
          title="Crear grupo"
          description="Tercer nivel, dependiente de una subfamilia."
        >
          <form action="/api/item-taxonomy" method="post" className="space-y-4">
            <input type="hidden" name="action" value="create-group" />
            <input type="hidden" name="redirectTo" value={redirectTo} />
            {contractId ? <input type="hidden" name="contractId" value={contractId} /> : null}
            <SelectField
              label="Subfamilia"
              name="subfamilyId"
              options={subfamilies.map((subfamily) => ({
                value: subfamily.id,
                label: `${subfamily.wbs ? `${subfamily.wbs} · ` : ""}${subfamily.name}`,
              }))}
            />
            <Field label="Nombre" name="name" placeholder="Terraplenes" />
            <Field label="WBS" name="wbs" placeholder="1.1.1" />
            <SubmitButton text="Crear grupo" />
          </form>
        </CreateCard>
      </section>

      <section className="space-y-5">
        {families.length > 0 ? (
          families.map((family) => (
            <article
              key={family.id}
              className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-[0_12px_30px_rgba(15,23,42,0.05)]"
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-teal-700">
                    Familia
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-950">
                    <span className="text-teal-700">{family.wbs || "Sin WBS"}</span>
                    {" · "}
                    {family.name}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <details className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">
                    <summary className="cursor-pointer list-none text-xs font-medium text-slate-700">
                      Editar
                    </summary>
                    <form action="/api/item-taxonomy" method="post" className="mt-3 grid gap-3 md:grid-cols-[1fr_0.7fr_auto]">
                      <input type="hidden" name="action" value="update-family" />
                      <input type="hidden" name="redirectTo" value={redirectTo} />
                      <input type="hidden" name="familyId" value={family.id} />
                      <Field label="Nombre familia" name={`family-name-${family.id}`} defaultValue={family.name} inputName="name" />
                      <Field label="WBS" name={`family-wbs-${family.id}`} defaultValue={family.wbs ?? ""} inputName="wbs" placeholder="1" />
                      <InlineSubmit text="Guardar" compact />
                    </form>
                  </details>
                  <ToggleForm
                    action="toggle-family"
                    idField="familyId"
                    idValue={family.id}
                    active={family.active}
                    redirectTo={redirectTo}
                    compact
                  />
                </div>
              </div>

              <div className="mt-4 space-y-3 border-l border-slate-200 pl-4">
                {family.subfamilies.length > 0 ? (
                  family.subfamilies.map((subfamily) => (
                    <div
                      key={subfamily.id}
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-3"
                    >
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="min-w-0">
                          <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                            Subfamilia
                          </p>
                          <p className="mt-1 text-sm font-medium text-slate-900">
                            <span className="text-teal-700">{subfamily.wbs || "Sin WBS"}</span>
                            {" · "}
                            {subfamily.name}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {subfamily.groups.length} grupos
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <details className="rounded-full border border-slate-200 bg-white px-3 py-1.5">
                            <summary className="cursor-pointer list-none text-xs font-medium text-slate-700">
                              Editar
                            </summary>
                            <form action="/api/item-taxonomy" method="post" className="mt-3 grid gap-3 md:grid-cols-[1fr_0.7fr_auto]">
                              <input type="hidden" name="action" value="update-subfamily" />
                              <input type="hidden" name="redirectTo" value={redirectTo} />
                              <input type="hidden" name="subfamilyId" value={subfamily.id} />
                              <Field label="Nombre subfamilia" name={`subfamily-name-${subfamily.id}`} defaultValue={subfamily.name} inputName="name" />
                              <Field label="WBS" name={`subfamily-wbs-${subfamily.id}`} defaultValue={subfamily.wbs ?? ""} inputName="wbs" placeholder="1.1" />
                              <InlineSubmit text="Guardar" compact />
                            </form>
                          </details>
                          <ToggleForm
                            action="toggle-subfamily"
                            idField="subfamilyId"
                            idValue={subfamily.id}
                            active={subfamily.active}
                            redirectTo={redirectTo}
                            compact
                          />
                        </div>
                      </div>

                      <div className="mt-3 space-y-2 border-l border-slate-200 pl-3">
                        {subfamily.groups.length > 0 ? (
                          subfamily.groups.map((group) => (
                            <div
                              key={group.id}
                              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5"
                            >
                              <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                                <p className="text-sm text-slate-900">
                                  <span className="font-medium text-teal-700">
                                    {group.wbs || "Sin WBS"}
                                  </span>
                                  {" · "}
                                  {group.name}
                                </p>
                                <div className="flex flex-wrap items-center gap-2">
                                  <details className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">
                                    <summary className="cursor-pointer list-none text-xs font-medium text-slate-700">
                                      Editar
                                    </summary>
                                    <form action="/api/item-taxonomy" method="post" className="mt-3 space-y-3">
                                      <input type="hidden" name="action" value="update-group" />
                                      <input type="hidden" name="redirectTo" value={redirectTo} />
                                      <input type="hidden" name="groupId" value={group.id} />
                                      <Field label="Nombre grupo" name={`group-name-${group.id}`} defaultValue={group.name} inputName="name" />
                                      <Field label="WBS" name={`group-wbs-${group.id}`} defaultValue={group.wbs ?? ""} inputName="wbs" placeholder="1.1.1" />
                                      <InlineSubmit text="Guardar" compact />
                                    </form>
                                  </details>
                                  <ToggleForm
                                    action="toggle-group"
                                    idField="groupId"
                                    idValue={group.id}
                                    active={group.active}
                                    redirectTo={redirectTo}
                                    compact
                                  />
                                </div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-slate-500">Sin grupos aun.</p>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">Esta familia aun no tiene subfamilias.</p>
                )}
              </div>
            </article>
          ))
        ) : (
          <article className="rounded-[2rem] border border-dashed border-slate-300 bg-white p-8 text-center shadow-[0_20px_50px_rgba(15,23,42,0.04)]">
            <h2 className="text-2xl font-semibold text-slate-950">Sin jerarquia aun</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Crea primero una familia, luego una subfamilia y finalmente sus grupos para activar los desplegables dependientes en partidas.
            </p>
          </article>
        )}
      </section>
    </>
  );
}

function CreateCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <article className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-[0_20px_50px_rgba(15,23,42,0.06)]">
      <h2 className="text-2xl font-semibold text-slate-950">{title}</h2>
      <p className="mt-2 text-sm leading-7 text-slate-600">{description}</p>
      <div className="mt-6">{children}</div>
    </article>
  );
}

function Field(props: {
  label: string;
  name: string;
  placeholder?: string;
  defaultValue?: string;
  inputName?: string;
}) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-700" htmlFor={props.name}>
        {props.label}
      </label>
      <input
        id={props.name}
        name={props.inputName ?? props.name}
        placeholder={props.placeholder}
        defaultValue={props.defaultValue}
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
        <option value="">Selecciona una opcion</option>
        {props.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function SubmitButton({ text }: { text: string }) {
  return (
    <button
      type="submit"
      className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
    >
      {text}
    </button>
  );
}

function InlineSubmit({ text, compact = false }: { text: string; compact?: boolean }) {
  return (
    <button
      type="submit"
      className={`rounded-full bg-slate-950 text-sm font-semibold text-white transition hover:bg-slate-800 ${
        compact ? "px-4 py-2 self-end" : "px-5 py-3"
      }`}
    >
      {text}
    </button>
  );
}

function ToggleForm({
  action,
  idField,
  idValue,
  active,
  redirectTo,
  compact = false,
}: {
  action: string;
  idField: string;
  idValue: string;
  active: boolean;
  redirectTo: string;
  compact?: boolean;
}) {
  return (
    <form action="/api/item-taxonomy" method="post">
      <input type="hidden" name="action" value={action} />
      <input type="hidden" name="redirectTo" value={redirectTo} />
      <input type="hidden" name={idField} value={idValue} />
      <input type="hidden" name="active" value={String(!active)} />
      <button
        type="submit"
        className={`rounded-full border text-xs font-medium transition ${
          active
            ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300"
            : "border-slate-300 bg-white text-slate-600 hover:border-slate-400"
        } ${compact ? "px-3 py-1.5" : "px-4 py-2"}`}
      >
        {active ? "Desactivar" : "Activar"}
      </button>
    </form>
  );
}
