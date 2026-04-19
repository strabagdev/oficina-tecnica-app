"use client";

import Link from "next/link";
import type { FormEvent, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
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

type ImportValidationState =
  | { status: "idle"; message: string }
  | { status: "validating"; message: string }
  | { status: "error"; message: string }
  | { status: "success"; message: string; validatedSignature: string };

type ImportSubmissionState =
  | { status: "idle"; message: string }
  | { status: "submitting"; message: string }
  | { status: "error"; message: string };

function resolveInitialModalState(
  initialModal: string,
  editItemId: string,
): ModalState {
  if (initialModal === "create") {
    return { type: "create" };
  }

  if (initialModal === "import") {
    return { type: "import" };
  }

  if (initialModal === "unit") {
    return { type: "unit" };
  }

  if (initialModal === "edit" && editItemId) {
    return { type: "edit", itemId: editItemId };
  }

  return null;
}

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
  importMode,
  showTable = true,
  editMode = false,
  taxonomyReady = true,
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
  importMode: "create" | "update";
  showTable?: boolean;
  editMode?: boolean;
  taxonomyReady?: boolean;
}) {
  const importFormRef = useRef<HTMLFormElement | null>(null);
  const importFileInputRef = useRef<HTMLInputElement | null>(null);
  const importSubmissionLockRef = useRef(false);
  const [activeModal, setActiveModal] = useState<ModalState>(() =>
    resolveInitialModalState(initialModal, editItemId),
  );
  const [showCreateUnitForm, setShowCreateUnitForm] = useState(
    () => initialModal === "unit" && Boolean(unitDraft.code || unitDraft.name || unitDraft.sortOrder),
  );
  const [createUnitError, setCreateUnitError] = useState("");
  const [editUnitErrors, setEditUnitErrors] = useState<Record<string, string>>({});
  const [currentImportMode, setCurrentImportMode] = useState<"create" | "update">(importMode);
  const [currentImportSignature, setCurrentImportSignature] = useState("");
  const [importValidationProgress, setImportValidationProgress] = useState(0);
  const [importSubmissionProgress, setImportSubmissionProgress] = useState(0);
  const [importValidation, setImportValidation] = useState<ImportValidationState>({
    status: "idle",
    message: "Valida el archivo antes de habilitar la importacion.",
  });
  const [importSubmission, setImportSubmission] = useState<ImportSubmissionState>({
    status: "idle",
    message: "Cuando el archivo este validado, podras importarlo.",
  });

  const resolvedEditItem =
    activeModal?.type === "edit"
      ? items.find((candidate) => candidate.id === activeModal.itemId) ?? null
      : null;
  const hasEditDraft =
    Boolean(editDraft.familyId) ||
    Boolean(editDraft.subfamilyId) ||
    Boolean(editDraft.groupId) ||
    Boolean(editDraft.itemNumber) ||
    Boolean(editDraft.description) ||
    Boolean(editDraft.unit) ||
    Boolean(editDraft.quantity) ||
    Boolean(editDraft.unitPrice);

  const activeUnitOptions = useMemo(
    () => measurementUnits.filter((unit) => unit.active),
    [measurementUnits],
  );

  useEffect(() => {
    if (importValidation.status === "validating") {
      const intervalId = window.setInterval(() => {
        setImportValidationProgress((current) => {
          if (current >= 99) {
            return current;
          }

          if (current < 40) {
            return Math.min(current + 8, 99);
          }

          if (current < 70) {
            return Math.min(current + 4, 99);
          }

          if (current < 85) {
            return Math.min(current + 2, 99);
          }

          return Math.min(current + 1, 99);
        });
      }, 220);

      return () => {
        window.clearInterval(intervalId);
      };
    }
  }, [importValidation.status]);

  useEffect(() => {
    if (importSubmission.status === "submitting") {
      const intervalId = window.setInterval(() => {
        setImportSubmissionProgress((current) => {
          if (current >= 99) {
            return current;
          }

          if (current < 35) {
            return Math.min(current + 7, 99);
          }

          if (current < 65) {
            return Math.min(current + 4, 99);
          }

          if (current < 85) {
            return Math.min(current + 2, 99);
          }

          return Math.min(current + 1, 99);
        });
      }, 260);

      return () => {
        window.clearInterval(intervalId);
      };
    }
  }, [importSubmission.status]);

  function buildImportSignature() {
    const file = importFileInputRef.current?.files?.[0];

    if (!file) {
      return "";
    }

    return [currentImportMode, file.name, file.size, file.lastModified].join("::");
  }

  function resetImportValidation(message = "Valida el archivo antes de habilitar la importacion.") {
    importSubmissionLockRef.current = false;
    setImportValidationProgress(0);
    setImportValidation({
      status: "idle",
      message,
    });
    setImportSubmissionProgress(0);
    setImportSubmission({
      status: "idle",
      message: "Cuando el archivo este validado, podras importarlo.",
    });
  }

  async function handleValidateImport() {
    const form = importFormRef.current;

    if (!form) {
      return;
    }

    const signature = buildImportSignature();

    if (!signature) {
      setImportValidationProgress(0);
      setImportValidation({
        status: "error",
        message: "Selecciona un archivo Excel antes de validar.",
      });
      return;
    }

    setImportValidation({
      status: "validating",
      message: "Validando archivo...",
    });
    setImportValidationProgress(10);

    try {
      const response = await fetch("/api/contract-items/import/validate", {
        method: "POST",
        body: new FormData(form),
      });
      const responseText = await response.text();
      let payload: { error?: string; success?: string } = {};

      if (responseText) {
        try {
          payload = JSON.parse(responseText) as { error?: string; success?: string };
        } catch {
          payload = {
            error: responseText,
          };
        }
      }

      if (!response.ok || !payload.success) {
        setImportValidationProgress(0);
        setImportValidation({
          status: "error",
          message:
            payload.error ??
            `No pude validar el archivo Excel. Respuesta ${response.status}.`,
        });
        return;
      }

      setImportValidation({
        status: "success",
        message: payload.success,
        validatedSignature: signature,
      });
      setImportValidationProgress(100);
    } catch {
      setImportValidation({
        status: "error",
        message: "Ocurrio un problema de red al validar el archivo Excel.",
      });
      setImportValidationProgress(0);
    }
  }

  function handleImportFormChange() {
    setCurrentImportSignature(buildImportSignature());
    resetImportValidation();
  }

  function handleImportModeChange(mode: "create" | "update") {
    setCurrentImportMode(mode);
    resetImportValidation();
  }

  async function handleImportSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (importSubmissionLockRef.current) {
      return;
    }

    const isReady =
      importValidation.status === "success" &&
      importValidation.validatedSignature === currentImportSignature;

    if (!isReady) {
      setImportValidation({
        status: "error",
        message: "Primero valida el archivo antes de importarlo.",
      });
      setImportSubmissionProgress(0);
      setImportSubmission({
        status: "error",
        message: "Primero valida el archivo antes de importarlo.",
      });
      return;
    }

    const form = importFormRef.current;

    if (!form) {
      return;
    }

    importSubmissionLockRef.current = true;

    setImportSubmission({
      status: "submitting",
      message: "Subiendo e importando el archivo validado...",
    });
    setImportSubmissionProgress(8);

    try {
      const response = await fetch(form.action, {
        method: "POST",
        body: new FormData(form),
        headers: {
          "x-import-request": "1",
        },
      });
      const responseText = await response.text();
      let payload: { error?: string; message?: string; redirectTo?: string } = {};

      if (responseText) {
        try {
          payload = JSON.parse(responseText) as {
            error?: string;
            message?: string;
            redirectTo?: string;
          };
        } catch {
          payload = {
            error: responseText,
          };
        }
      }

      if (!response.ok || !payload.redirectTo) {
        importSubmissionLockRef.current = false;
        setImportSubmissionProgress(0);
        setImportSubmission({
          status: "error",
          message:
            payload.error ??
            payload.message ??
            `No pude importar el archivo validado. Respuesta ${response.status}.`,
        });
        return;
      }

      setImportSubmissionProgress(100);
      window.location.href = payload.redirectTo;
    } catch {
      importSubmissionLockRef.current = false;
      setImportSubmissionProgress(0);
      setImportSubmission({
        status: "error",
        message: "Ocurrio un problema de red al importar el archivo validado.",
      });
    }
  }

  const isImportReady =
    importValidation.status === "success" &&
    importValidation.validatedSignature === currentImportSignature;

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <IconActionButton
          label="Nueva partida"
          onClick={() => setActiveModal({ type: "create" })}
          tone="primary"
          disabled={!taxonomyReady}
        >
          <PlusIcon />
        </IconActionButton>
        <IconActionButton
          label={editMode ? "Salir de modo edición" : "Entrar en modo edición"}
          onClick={() => toggleQueryParam("editMode", editMode ? "" : "1")}
          tone={editMode ? "primary" : "default"}
          disabled={!taxonomyReady}
        >
          <PencilIcon />
        </IconActionButton>
        <IconActionButton
          label="Importar XLSX"
          onClick={() => setActiveModal({ type: "import" })}
          disabled={!taxonomyReady}
        >
          <UploadIcon />
        </IconActionButton>
        <IconActionButton
          label="Editar unidades"
          onClick={() => setActiveModal({ type: "unit" })}
          tone="teal"
        >
          <SlidersIcon />
        </IconActionButton>
      </div>

      {showTable ? (
        <section className="mt-5 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-[0_20px_50px_rgba(15,23,42,0.06)]">
          <div>
            <h2 className="text-2xl font-semibold text-slate-950">Administracion de partidas</h2>
            <p className="mt-1.5 max-w-3xl text-sm leading-6 text-slate-600">
              Mantiene el itemizado operativo desde una sola vista: crea, importa y corrige
              partidas sin salir del contexto del contrato.
            </p>
          </div>

          {items.length > 0 ? (
            <div className="mt-5 overflow-x-auto rounded-[1.5rem] border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-medium">Item</th>
                    <th className="px-4 py-3 font-medium">Descripcion</th>
                    <th className="px-4 py-3 font-medium">Unidad</th>
                    <th className="px-4 py-3 font-medium">Cantidad</th>
                    <th className="px-4 py-3 font-medium whitespace-nowrap">P. unitario</th>
                    <th className="px-4 py-3 font-medium whitespace-nowrap">Monto base</th>
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
                      <td className="px-4 py-3 text-slate-700 whitespace-nowrap tabular-nums min-w-28">
                        {item.unitPriceValue}
                      </td>
                      <td className="px-4 py-3 text-slate-700 whitespace-nowrap tabular-nums min-w-32">
                        {item.originalAmount}
                      </td>
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
            <div className="mt-5 rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-sm leading-6 text-slate-600">
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
          ref={importFormRef}
          action="/api/contract-items/import"
          method="post"
          encType="multipart/form-data"
          className="space-y-4"
          onChange={handleImportFormChange}
          onSubmit={handleImportSubmit}
        >
          <input type="hidden" name="contractId" value={contractId} />
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <input type="hidden" name="returnModal" value="import" />
          <Link
            href="/api/contract-items/template"
            className="inline-flex rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-900 hover:text-slate-950"
          >
            Descargar archivo de referencia
          </Link>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700" htmlFor="import-file">
              Archivo Excel
            </label>
            <input
              ref={importFileInputRef}
              id="import-file"
              name="file"
              type="file"
              accept=".xlsx,.xls"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
            />
          </div>
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium text-slate-700">Modo de importacion</legend>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                <input
                  type="radio"
                  name="importMode"
                  value="create"
                  checked={currentImportMode === "create"}
                  onChange={() => handleImportModeChange("create")}
                  className="mr-2"
                />
                Crear nuevas partidas
                <span className="mt-1 block text-xs leading-5 text-slate-500">
                  Rechaza el archivo si algun numero de itemizado ya existe en el contrato.
                </span>
              </label>
              <label className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                <input
                  type="radio"
                  name="importMode"
                  value="update"
                  checked={currentImportMode === "update"}
                  onChange={() => handleImportModeChange("update")}
                  className="mr-2"
                />
                Actualizar existentes
                <span className="mt-1 block text-xs leading-5 text-slate-500">
                  Rechaza el archivo si algun numero de itemizado no existe en el contrato.
                </span>
              </label>
            </div>
          </fieldset>
          <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
            Antes de persistir, validamos todo el Excel completo. La familia es obligatoria.
            Subfamilia y grupo pueden quedar vacios cuando la partida dependa directamente de una
            familia.
          </div>
          {importValidation.status === "validating" || importValidation.status === "success" ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                <span>Progreso de validacion</span>
                <span>{importValidationProgress}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                <div
                  className={`h-full rounded-full transition-[width] duration-200 ${
                    importValidation.status === "success" ? "bg-emerald-500" : "bg-slate-900"
                  }`}
                  style={{ width: `${importValidationProgress}%` }}
                />
              </div>
            </div>
          ) : null}
          {importSubmission.status === "submitting" || importSubmission.status === "error" ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                <span>Progreso de importacion</span>
                <span>{importSubmissionProgress}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                <div
                  className={`h-full rounded-full transition-[width] duration-200 ${
                    importSubmission.status === "error" ? "bg-rose-500" : "bg-sky-600"
                  }`}
                  style={{ width: `${importSubmissionProgress}%` }}
                />
              </div>
            </div>
          ) : null}
          <div
            className={`rounded-2xl px-4 py-3 text-sm leading-6 ${
              importValidation.status === "error"
                ? "bg-rose-50 text-rose-700"
                : importValidation.status === "success"
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-slate-50 text-slate-600"
            }`}
          >
            {importValidation.message}
          </div>
          <div
            className={`rounded-2xl px-4 py-3 text-sm leading-6 ${
              importSubmission.status === "error"
                ? "bg-rose-50 text-rose-700"
                : importSubmission.status === "submitting"
                  ? "bg-sky-50 text-sky-700"
                  : "bg-slate-50 text-slate-600"
            }`}
          >
            {importSubmission.message}
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleValidateImport}
              disabled={
                importValidation.status === "validating" ||
                importSubmission.status === "submitting"
              }
              className="rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-900 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {importValidation.status === "validating" ? "Validando..." : "Validar archivo"}
            </button>
            <button
              type="submit"
              disabled={
                !isImportReady ||
                importSubmission.status === "submitting"
              }
              className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {importSubmission.status === "submitting" ? "Importando..." : "Importar XLSX"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={activeModal?.type === "unit"}
        onClose={() => setActiveModal(null)}
        title="Editar unidades"
        description="Administra el catalogo de unidades y crea una nueva solo cuando realmente haga falta."
        size="xl"
      >
        <div className="space-y-5">
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

          <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
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
                className="mt-4 grid gap-3 md:grid-cols-3"
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
              editItemId === resolvedEditItem.id && hasEditDraft
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
      className="space-y-4"
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
      <div className="grid gap-3 xl:grid-cols-4">
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
      <Field
        label="Descripcion"
        name="description"
        defaultValue={draft.description}
        placeholder="Descripcion de la partida"
        inputId={`${idPrefix}-description`}
        required
      />
      {error ? <p className="text-sm font-medium text-rose-600">{error}</p> : null}
      <div className="flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
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
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-slate-700" htmlFor={inputId}>
        {label}
      </label>
      <input
        id={inputId}
        name={name}
        placeholder={placeholder}
        defaultValue={defaultValue}
        required={required}
        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[#0f766e] focus:ring-4 focus:ring-[#99f6e4]"
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
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-slate-700" htmlFor={inputId}>
        {label}
      </label>
      <select
        id={inputId}
        name={name}
        defaultValue={defaultValue ?? ""}
        required={required}
        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[#0f766e] focus:ring-4 focus:ring-[#99f6e4]"
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

function IconActionButton({
  label,
  onClick,
  tone = "default",
  children,
  disabled = false,
}: {
  label: string;
  onClick: () => void;
  tone?: "default" | "primary" | "teal";
  children: ReactNode;
  disabled?: boolean;
}) {
  const className =
    tone === "primary"
      ? "bg-slate-950 text-white hover:bg-slate-800"
      : tone === "teal"
        ? "border border-[#0f766e] bg-white text-[#0f766e] hover:bg-[#f0fdfa]"
        : "border border-slate-300 bg-white text-slate-700 hover:border-slate-900 hover:text-slate-950";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      disabled={disabled}
      className={`inline-flex h-11 w-11 items-center justify-center rounded-full transition ${
        disabled
          ? "cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400"
          : className
      }`}
    >
      <span aria-hidden="true">{children}</span>
    </button>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-[2]">
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-[2]">
      <path d="M12 16V5" />
      <path d="M8 9l4-4 4 4" />
      <path d="M5 19h14" />
    </svg>
  );
}

function SlidersIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-[2]">
      <path d="M4 6h10" />
      <path d="M18 6h2" />
      <circle cx="16" cy="6" r="2" />
      <path d="M4 12h2" />
      <path d="M10 12h10" />
      <circle cx="8" cy="12" r="2" />
      <path d="M4 18h10" />
      <path d="M18 18h2" />
      <circle cx="16" cy="18" r="2" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-[2]">
      <path d="M4 20h4l10-10-4-4L4 16v4Z" />
      <path d="m12 6 4 4" />
    </svg>
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

  if (!isNonNegativeDecimal(quantity)) {
    return "Ingresa una cantidad valida igual o mayor que cero.";
  }

  if (!isNonNegativeDecimal(unitPrice)) {
    return "Ingresa un precio unitario valido igual o mayor que cero.";
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

function isNonNegativeDecimal(value: string) {
  const normalized = value.replace(/\s+/g, "").replace(",", ".");

  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    return false;
  }

  return Number(normalized) >= 0;
}

function toggleQueryParam(key: string, value: string) {
  const url = new URL(window.location.href);

  if (value) {
    url.searchParams.set(key, value);
  } else {
    url.searchParams.delete(key);
    url.searchParams.delete("modal");
    url.searchParams.delete("editItemId");
  }

  window.location.assign(url.toString());
}
