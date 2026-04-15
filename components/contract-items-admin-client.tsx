"use client";

import { useEffect, useMemo, useState } from "react";
import { ItemTaxonomyFields } from "@/components/item-taxonomy-fields";
import { Modal } from "@/components/modal";

type MeasurementUnitOption = {
  id: string;
  code: string;
  name: string;
  sortOrder: number;
  active: boolean;
};

type TaxonomyFamily = {
  id: string;
  name: string;
  wbs?: string | null;
};

type TaxonomySubfamily = {
  id: string;
  familyId: string;
  name: string;
  familyName: string;
  wbs?: string | null;
};

type TaxonomyGroup = {
  id: string;
  familyId: string;
  subfamilyId: string;
  name: string;
  subfamilyName: string;
  wbs?: string | null;
};

type ContractItemRecord = {
  id: string;
  family: string | null;
  subfamily: string | null;
  itemGroup: string | null;
  itemNumberValue: string;
  description: string;
  unit: string | null;
  originalQuantityValue: string;
  unitPriceValue: string;
  originalAmount: string;
};

type DraftState = {
  familyId: string;
  subfamilyId: string;
  groupId: string;
  itemNumber: string;
  description: string;
  unit: string;
  quantity: string;
  unitPrice: string;
};

type UnitDraftState = {
  code: string;
  name: string;
  sortOrder: string;
};

type UnitEditDraftState = {
  unitId: string;
  code: string;
  name: string;
  sortOrder: string;
};

type ModalState =
  | { type: "create" }
  | { type: "import" }
  | { type: "unit" }
  | { type: "edit"; itemId: string }
  | null;

export function ContractItemsAdminClient({
  contractId,
  contractCode,
  items,
  measurementUnits,
  itemTaxonomy,
  redirectTo,
  initialModal,
  createDraft,
  editDraft,
  editItemId,
  unitDraft,
  unitEditDraft,
  showTable = true,
}: {
  contractId: string;
  contractCode: string;
  items: ContractItemRecord[];
  measurementUnits: MeasurementUnitOption[];
  itemTaxonomy: {
    families: TaxonomyFamily[];
    subfamilies: TaxonomySubfamily[];
    groups: TaxonomyGroup[];
  };
  redirectTo: string;
  initialModal: string;
  createDraft: DraftState;
  editDraft: DraftState;
  editItemId: string;
  unitDraft: UnitDraftState;
  unitEditDraft: UnitEditDraftState;
  showTable?: boolean;
}) {
  const [activeModal, setActiveModal] = useState<ModalState>(null);
  const [showCreateUnitForm, setShowCreateUnitForm] = useState(false);
  const [createUnitError, setCreateUnitError] = useState("");
  const [editUnitErrors, setEditUnitErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (initialModal === "create") {
      setActiveModal({ type: "create" });
      return;
    }

    if (initialModal === "import") {
      setActiveModal({ type: "import" });
      return;
    }

    if (initialModal === "unit") {
      setActiveModal({ type: "unit" });
      if (unitDraft.code || unitDraft.name || unitDraft.sortOrder) {
        setShowCreateUnitForm(true);
      }
      return;
    }

    if (initialModal === "edit" && editItemId) {
      setActiveModal({ type: "edit", itemId: editItemId });
    }
  }, [editItemId, initialModal, unitDraft.code, unitDraft.name, unitDraft.sortOrder]);

  const resolvedEditItem =
    activeModal?.type === "edit"
      ? items.find((candidate) => candidate.id === activeModal.itemId) ?? null
      : null;

  const activeUnitOptions = useMemo(
    () => measurementUnits.filter((unit) => unit.active),
    [measurementUnits],
  );

  return (
    <>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => setActiveModal({ type: "create" })}
          className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          Nueva partida
        </button>
        <button
          type="button"
          onClick={() => setActiveModal({ type: "import" })}
          className="rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-900 hover:text-slate-950"
        >
          Importar XLSX
        </button>
        <button
          type="button"
          onClick={() => setActiveModal({ type: "unit" })}
          className="rounded-full border border-[#0f766e] px-5 py-3 text-sm font-semibold text-[#0f766e] transition hover:bg-[#f0fdfa]"
        >
          Editar unidades
        </button>
      </div>

      {showTable ? (
        <section className="mt-6 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_20px_50px_rgba(15,23,42,0.06)]">
          <div>
            <h2 className="text-2xl font-semibold text-slate-950">Administracion de partidas</h2>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">
              Mantiene el itemizado operativo desde una sola vista: crea, importa y corrige
              partidas sin salir del contexto del contrato.
            </p>
          </div>

          {items.length > 0 ? (
            <div className="mt-6 overflow-x-auto rounded-[1.5rem] border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-medium">Item</th>
                    <th className="px-4 py-3 font-medium">Descripcion</th>
                    <th className="px-4 py-3 font-medium">Unidad</th>
                    <th className="px-4 py-3 font-medium">Cantidad</th>
                    <th className="px-4 py-3 font-medium">P. unitario</th>
                    <th className="px-4 py-3 font-medium">Monto base</th>
                    <th className="px-4 py-3 font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {items.map((item) => (
                    <tr key={item.id} className="align-top">
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {item.itemNumberValue}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        <div className="font-medium text-slate-900">{item.description}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {[item.family, item.subfamily, item.itemGroup].filter(Boolean).join(" / ") ||
                            "Sin clasificacion adicional"}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{item.unit ?? "-"}</td>
                      <td className="px-4 py-3 text-slate-700">{item.originalQuantityValue}</td>
                      <td className="px-4 py-3 text-slate-700">{item.unitPriceValue}</td>
                      <td className="px-4 py-3 text-slate-700">{item.originalAmount}</td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => setActiveModal({ type: "edit", itemId: item.id })}
                          className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-900 hover:text-slate-950"
                        >
                          Editar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="mt-6 rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-sm leading-7 text-slate-600">
              Todavia no hay partidas cargadas en{" "}
              <span className="font-semibold text-slate-900">{contractCode}</span>. Usa Nueva
              partida o Importar XLSX para comenzar.
            </div>
          )}
        </section>
      ) : null}

      <Modal
        open={activeModal?.type === "create"}
        onClose={() => setActiveModal(null)}
        title="Nueva partida"
        description="Ingresa la partida manualmente y manten la clasificacion WBS dentro del mismo flujo."
        size="xl"
      >
        <ItemForm
          action="/api/contract-items"
          contractId={contractId}
          redirectTo={redirectTo}
          returnModal="create"
          taxonomy={itemTaxonomy}
          measurementUnits={activeUnitOptions}
          submitLabel="Guardar partida"
          draft={createDraft}
          idPrefix="create-item"
        />
      </Modal>

      <Modal
        open={activeModal?.type === "import"}
        onClose={() => setActiveModal(null)}
        title="Importar partidas"
        description="Carga un archivo Excel con varias partidas de una vez y usa la plantilla como referencia."
        size="md"
      >
        <form
          action="/api/contract-items/import"
          method="post"
          encType="multipart/form-data"
          className="space-y-5"
        >
          <input type="hidden" name="contractId" value={contractId} />
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <input type="hidden" name="returnModal" value="import" />
          <a
            href="/api/contract-items/template"
            className="inline-flex rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-900 hover:text-slate-950"
          >
            Descargar archivo de referencia
          </a>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700" htmlFor="import-file">
              Archivo Excel
            </label>
            <input
              id="import-file"
              name="file"
              type="file"
              accept=".xlsx,.xls"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
            />
          </div>
          <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm leading-7 text-slate-600">
            La familia es obligatoria. Subfamilia y grupo pueden quedar vacios cuando la partida
            dependa directamente de una familia.
          </div>
          <button
            type="submit"
            className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Importar XLSX
          </button>
        </form>
      </Modal>

      <Modal
        open={activeModal?.type === "unit"}
        onClose={() => setActiveModal(null)}
        title="Editar unidades"
        description="Administra el catalogo de unidades y crea una nueva solo cuando realmente haga falta."
        size="xl"
      >
        <div className="space-y-6">
          <div className="overflow-x-auto rounded-[1.5rem] border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Codigo</th>
                  <th className="px-4 py-3 font-medium">Nombre</th>
                  <th className="px-4 py-3 font-medium">Orden</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {measurementUnits.map((unit) => {
                  const isEditing = unitEditDraft.unitId === unit.id;

                  return (
                    <tr key={unit.id} className="align-top">
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {isEditing ? (
                          <input
                            form={`unit-edit-${unit.id}`}
                            name="code"
                            defaultValue={unitEditDraft.code}
                            className="w-full min-w-24 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-[#0f766e] focus:ring-4 focus:ring-[#99f6e4]"
                          />
                        ) : (
                          unit.code
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {isEditing ? (
                          <input
                            form={`unit-edit-${unit.id}`}
                            name="name"
                            defaultValue={unitEditDraft.name}
                            className="w-full min-w-44 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-[#0f766e] focus:ring-4 focus:ring-[#99f6e4]"
                          />
                        ) : (
                          unit.name
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {isEditing ? (
                          <input
                            form={`unit-edit-${unit.id}`}
                            name="sortOrder"
                            defaultValue={unitEditDraft.sortOrder}
                            className="w-24 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-[#0f766e] focus:ring-4 focus:ring-[#99f6e4]"
                          />
                        ) : (
                          unit.sortOrder
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-medium ${
                            unit.active
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-rose-100 text-rose-700"
                          }`}
                        >
                          {unit.active ? "Activa" : "Inactiva"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          {isEditing ? (
                            <>
                              <form
                                id={`unit-edit-${unit.id}`}
                                action="/api/measurement-units"
                                method="post"
                                className="contents"
                                onSubmit={(event) => {
                                  const formData = new FormData(event.currentTarget);
                                  const error = validateUnitFormData(formData);

                                  if (error) {
                                    event.preventDefault();
                                    setEditUnitErrors((current) => ({
                                      ...current,
                                      [unit.id]: error,
                                    }));
                                    return;
                                  }

                                  setEditUnitErrors((current) => {
                                    const next = { ...current };
                                    delete next[unit.id];
                                    return next;
                                  });
                                }}
                              >
                                <input type="hidden" name="action" value="update" />
                                <input type="hidden" name="unitId" value={unit.id} />
                                <input type="hidden" name="redirectTo" value={redirectTo} />
                                <input type="hidden" name="returnModal" value="unit" />
                                <button
                                  type="submit"
                                  className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                                >
                                  Guardar
                                </button>
                              </form>
                              <ClearUnitEditButton />
                            </>
                          ) : (
                            <StartUnitEditButton unit={unit} />
                          )}

                          <form action="/api/measurement-units" method="post">
                            <input type="hidden" name="action" value="toggle-active" />
                            <input type="hidden" name="unitId" value={unit.id} />
                            <input type="hidden" name="redirectTo" value={redirectTo} />
                            <input type="hidden" name="returnModal" value="unit" />
                            <input
                              type="hidden"
                              name="active"
                              value={unit.active ? "false" : "true"}
                            />
                            <button
                              type="submit"
                              className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-900 hover:text-slate-950"
                            >
                              {unit.active ? "Desactivar" : "Activar"}
                            </button>
                          </form>
                        </div>
                        {editUnitErrors[unit.id] ? (
                          <p className="mt-2 text-xs font-medium text-rose-600">
                            {editUnitErrors[unit.id]}
                          </p>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-950">Crear nueva unidad</h3>
                <p className="mt-1 text-sm text-slate-600">
                  Usa esta opcion cuando la unidad necesaria no exista todavia en el catalogo.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateUnitForm((current) => !current)}
                className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-900 hover:text-slate-950"
              >
                {showCreateUnitForm ? "Ocultar" : "Crear nueva"}
              </button>
            </div>

            {showCreateUnitForm ? (
              <form
                action="/api/measurement-units"
                method="post"
                className="mt-5 grid gap-4 md:grid-cols-3"
                onSubmit={(event) => {
                  const formData = new FormData(event.currentTarget);
                  const error = validateUnitFormData(formData);

                  if (error) {
                    event.preventDefault();
                    setCreateUnitError(error);
                    return;
                  }

                  setCreateUnitError("");
                }}
              >
                <input type="hidden" name="action" value="create" />
                <input type="hidden" name="redirectTo" value={redirectTo} />
                <input type="hidden" name="returnModal" value="unit" />
                <Field
                  label="Codigo"
                  name="code"
                  defaultValue={unitDraft.code}
                  placeholder="m3"
                  inputId="unit-code"
                />
                <Field
                  label="Nombre"
                  name="name"
                  defaultValue={unitDraft.name}
                  placeholder="Metro cubico"
                  inputId="unit-name"
                />
                <Field
                  label="Orden"
                  name="sortOrder"
                  defaultValue={unitDraft.sortOrder}
                  placeholder="10"
                  inputId="unit-sort-order"
                />
                {createUnitError ? (
                  <p className="md:col-span-3 text-sm font-medium text-rose-600">
                    {createUnitError}
                  </p>
                ) : null}
                <div className="md:col-span-3">
                  <button
                    type="submit"
                    className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    Guardar unidad
                  </button>
                </div>
              </form>
            ) : null}
          </div>
        </div>
      </Modal>

      <Modal
        open={activeModal?.type === "edit" && Boolean(resolvedEditItem)}
        onClose={() => setActiveModal(null)}
        title={
          resolvedEditItem
            ? `Editar partida ${resolvedEditItem.itemNumberValue}`
            : "Editar partida"
        }
        description="Ajusta la partida sin salir del listado y recalcula el monto contractual al guardar."
        size="xl"
      >
        {resolvedEditItem ? (
          <ItemForm
            action={`/api/contract-items/${resolvedEditItem.id}`}
            contractId={contractId}
            redirectTo={redirectTo}
            returnModal="edit"
            taxonomy={itemTaxonomy}
            measurementUnits={activeUnitOptions}
            submitLabel="Guardar cambios"
            draft={
              editItemId === resolvedEditItem.id
                ? editDraft
                : {
                    familyId:
                      itemTaxonomy.families.find(
                        (family) => family.name === resolvedEditItem.family,
                      )?.id ?? "",
                    subfamilyId:
                      itemTaxonomy.subfamilies.find(
                        (subfamily) => subfamily.name === resolvedEditItem.subfamily,
                      )?.id ?? "",
                    groupId:
                      itemTaxonomy.groups.find((group) => group.name === resolvedEditItem.itemGroup)
                        ?.id ?? "",
                    itemNumber: resolvedEditItem.itemNumberValue,
                    description: resolvedEditItem.description,
                    unit: resolvedEditItem.unit ?? "",
                    quantity: resolvedEditItem.originalQuantityValue,
                    unitPrice: resolvedEditItem.unitPriceValue,
                  }
            }
            idPrefix={`edit-${resolvedEditItem.id}`}
            amountLabel={`Monto actual: ${resolvedEditItem.originalAmount}`}
          />
        ) : null}
      </Modal>
    </>
  );
}

function StartUnitEditButton({ unit }: { unit: MeasurementUnitOption }) {
  return (
    <button
      type="button"
      onClick={() => {
        const url = new URL(window.location.href);
        url.searchParams.set("modal", "unit");
        url.searchParams.set("editUnitId", unit.id);
        url.searchParams.set("editUnitCode", unit.code);
        url.searchParams.set("editUnitName", unit.name);
        url.searchParams.set("editUnitSortOrder", String(unit.sortOrder));
        window.location.assign(url.toString());
      }}
      className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-900 hover:text-slate-950"
    >
      Editar
    </button>
  );
}

function ClearUnitEditButton() {
  return (
    <button
      type="button"
      onClick={() => {
        const url = new URL(window.location.href);
        url.searchParams.delete("editUnitId");
        url.searchParams.delete("editUnitCode");
        url.searchParams.delete("editUnitName");
        url.searchParams.delete("editUnitSortOrder");
        window.location.assign(url.toString());
      }}
      className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-900 hover:text-slate-950"
    >
      Cancelar
    </button>
  );
}

function ItemForm({
  action,
  contractId,
  redirectTo,
  returnModal,
  taxonomy,
  measurementUnits,
  submitLabel,
  draft,
  idPrefix,
  amountLabel,
}: {
  action: string;
  contractId: string;
  redirectTo: string;
  returnModal: string;
  taxonomy: {
    families: TaxonomyFamily[];
    subfamilies: TaxonomySubfamily[];
    groups: TaxonomyGroup[];
  };
  measurementUnits: { code: string; name: string }[];
  submitLabel: string;
  draft: DraftState;
  idPrefix: string;
  amountLabel?: string;
}) {
  const [error, setError] = useState("");

  return (
    <form
      action={action}
      method="post"
      className="space-y-5"
      onSubmit={(event) => {
        const formData = new FormData(event.currentTarget);
        const validationError = validateItemFormData(formData);

        if (validationError) {
          event.preventDefault();
          setError(validationError);
          return;
        }

        setError("");
      }}
    >
      <input type="hidden" name="contractId" value={contractId} />
      <input type="hidden" name="redirectTo" value={redirectTo} />
      <input type="hidden" name="returnModal" value={returnModal} />
      <ItemTaxonomyFields
        families={taxonomy.families}
        subfamilies={taxonomy.subfamilies}
        groups={taxonomy.groups}
        defaultFamilyId={draft.familyId}
        defaultSubfamilyId={draft.subfamilyId}
        defaultGroupId={draft.groupId}
        idPrefix={`${idPrefix}-taxonomy`}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Field
          label="Numero itemizado"
          name="itemNumber"
          defaultValue={draft.itemNumber}
          placeholder="1.1"
          inputId={`${idPrefix}-item-number`}
          required
        />
        <SelectField
          label="Unidad"
          name="unit"
          defaultValue={draft.unit}
          inputId={`${idPrefix}-unit`}
          options={measurementUnits.map((unit) => ({
            value: unit.code,
            label: `${unit.code} · ${unit.name}`,
          }))}
          required
        />
      </div>
      <Field
        label="Descripcion"
        name="description"
        defaultValue={draft.description}
        placeholder="Descripcion de la partida"
        inputId={`${idPrefix}-description`}
        required
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Field
          label="Cantidad"
          name="quantity"
          defaultValue={draft.quantity}
          placeholder="1200"
          inputId={`${idPrefix}-quantity`}
          required
        />
        <Field
          label="Precio unitario"
          name="unitPrice"
          defaultValue={draft.unitPrice}
          placeholder="18500"
          inputId={`${idPrefix}-unit-price`}
          required
        />
      </div>
      {error ? <p className="text-sm font-medium text-rose-600">{error}</p> : null}
      <div className="flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-500">
          {amountLabel ?? "El monto base se recalcula automaticamente al guardar."}
        </p>
        <button
          type="submit"
          className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  placeholder,
  defaultValue,
  inputId,
  required = false,
}: {
  label: string;
  name: string;
  placeholder?: string;
  defaultValue?: string;
  inputId: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-700" htmlFor={inputId}>
        {label}
      </label>
      <input
        id={inputId}
        name={name}
        placeholder={placeholder}
        defaultValue={defaultValue}
        required={required}
        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0f766e] focus:ring-4 focus:ring-[#99f6e4]"
      />
    </div>
  );
}

function SelectField({
  label,
  name,
  defaultValue,
  options,
  inputId,
  required = false,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  options: { value: string; label: string }[];
  inputId: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-700" htmlFor={inputId}>
        {label}
      </label>
      <select
        id={inputId}
        name={name}
        defaultValue={defaultValue ?? ""}
        required={required}
        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0f766e] focus:ring-4 focus:ring-[#99f6e4]"
      >
        <option value="">Selecciona unidad</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function validateItemFormData(formData: FormData) {
  const familyId = String(formData.get("familyId") ?? "").trim();
  const itemNumber = String(formData.get("itemNumber") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const unit = String(formData.get("unit") ?? "").trim();
  const quantity = String(formData.get("quantity") ?? "").trim();
  const unitPrice = String(formData.get("unitPrice") ?? "").trim();

  if (!familyId) {
    return "Selecciona una familia para la partida.";
  }

  if (!itemNumber) {
    return "Ingresa el numero de itemizado.";
  }

  if (!description) {
    return "Ingresa la descripcion de la partida.";
  }

  if (!unit) {
    return "Selecciona una unidad de medida.";
  }

  if (!isPositiveDecimal(quantity)) {
    return "Ingresa una cantidad valida mayor que cero.";
  }

  if (!isPositiveDecimal(unitPrice)) {
    return "Ingresa un precio unitario valido mayor que cero.";
  }

  return "";
}

function validateUnitFormData(formData: FormData) {
  const code = String(formData.get("code") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const sortOrder = String(formData.get("sortOrder") ?? "").trim();

  if (!code) {
    return "Ingresa el codigo de la unidad.";
  }

  if (!name) {
    return "Ingresa el nombre de la unidad.";
  }

  if (sortOrder && !/^-?\d+$/.test(sortOrder)) {
    return "El orden debe ser un numero entero.";
  }

  return "";
}

function isPositiveDecimal(value: string) {
  const normalized = value.replace(/\s+/g, "").replace(",", ".");

  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    return false;
  }

  return Number(normalized) > 0;
}
