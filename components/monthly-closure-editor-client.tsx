"use client";

import { DiscountMode, Prisma } from "@prisma/client";
import Link from "next/link";
import type { FormEvent } from "react";
import { useCallback, useMemo, useRef, useState } from "react";
import { parseDecimalInput } from "@/lib/numeric";

export type ClosureEditorItem = {
  id: string;
  itemNumber: string;
  itemCode: string;
  description: string;
  unit: string | null;
  unitPriceValue: string;
  originalQuantityValue: string;
  consumedQuantity: string;
  consumedAmount: string;
};

type RowEdit = {
  monthQty: string;
  discountMode: DiscountMode;
  discountValue: string;
  note: string;
};

type WizardStep = "select" | "entry";

function emptyRow(): RowEdit {
  return {
    monthQty: "",
    discountMode: DiscountMode.NONE,
    discountValue: "0",
    note: "",
  };
}

function formatMoneyPreview(value: Prisma.Decimal, currency: string) {
  const digits = currency === "CLP" || currency === "UF" ? 0 : 2;
  const n = Number(value.toFixed(digits));
  try {
    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: currency.length === 3 ? currency : "CLP",
      maximumFractionDigits: digits,
      minimumFractionDigits: digits,
    }).format(n);
  } catch {
    return `${currency} ${n.toLocaleString("es-CL")}`;
  }
}

function normalizeSearch(value: string) {
  return value.trim().toLowerCase();
}

function itemMatchesQuery(item: ClosureEditorItem, query: string) {
  if (!query) {
    return true;
  }

  const q = normalizeSearch(query);
  return (
    item.itemNumber.toLowerCase().includes(q) ||
    item.itemCode.toLowerCase().includes(q) ||
    item.description.toLowerCase().includes(q)
  );
}

export function MonthlyClosureEditorClient({
  contractId,
  contractCode,
  currency,
  redirectTo,
  items,
  initialEdit,
}: {
  contractId: string;
  contractCode: string;
  currency: string;
  redirectTo: string;
  items: ClosureEditorItem[];
  initialEdit?: {
    closureId: string;
    year: number;
    month: number;
    statementNumber: string;
    summaryNote: string;
    rows: Array<{
      contractItemId: string;
      monthQty: string;
      discountMode: DiscountMode;
      discountValue: string;
      note: string;
    }>;
  } | null;
}) {
  const now = new Date();
  const [step, setStep] = useState<WizardStep>(initialEdit ? "entry" : "select");
  const [filterQuery, setFilterQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set((initialEdit?.rows ?? []).map((row) => row.contractItemId)),
  );
  const [selectionError, setSelectionError] = useState<string | null>(null);

  const [year, setYear] = useState(initialEdit ? String(initialEdit.year) : String(now.getFullYear()));
  const [month, setMonth] = useState(initialEdit ? String(initialEdit.month) : String(now.getMonth() + 1));
  const [statementNumber, setStatementNumber] = useState(initialEdit?.statementNumber ?? "");
  const [summaryNote, setSummaryNote] = useState(initialEdit?.summaryNote ?? "");
  const [clientError, setClientError] = useState<string | null>(null);
  const jsonFieldRef = useRef<HTMLInputElement>(null);

  const [rows, setRows] = useState<Record<string, RowEdit>>(() => {
    const initial: Record<string, RowEdit> = {};
    for (const item of items) {
      initial[item.id] = emptyRow();
    }
    for (const row of initialEdit?.rows ?? []) {
      initial[row.contractItemId] = {
        monthQty: row.monthQty,
        discountMode: row.discountMode,
        discountValue: row.discountValue,
        note: row.note,
      };
    }
    return initial;
  });
  const isReplacingEdp = Boolean(initialEdit);

  const updateRow = useCallback((itemId: string, patch: Partial<RowEdit>) => {
    setRows((prev) => ({
      ...prev,
      [itemId]: { ...(prev[itemId] ?? emptyRow()), ...patch },
    }));
  }, []);

  const filteredForSelect = useMemo(
    () => items.filter((item) => itemMatchesQuery(item, filterQuery)),
    [items, filterQuery],
  );

  const selectedItemsOrdered = useMemo(() => {
    const set = selectedIds;
    return items.filter((item) => set.has(item.id));
  }, [items, selectedIds]);

  const selectedCount = selectedIds.size;

  const toggleOne = useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }, [setSelectedIds]);

  const selectIds = useCallback((ids: string[], mode: "add" | "remove") => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (mode === "add") {
          next.add(id);
        } else {
          next.delete(id);
        }
      }
      return next;
    });
  }, [setSelectedIds]);

  const removeSelectedItem = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, [setSelectedIds]);

  const toggleDiscount = useCallback((itemId: string, enabled: boolean) => {
    updateRow(itemId, {
      discountMode: enabled ? DiscountMode.AMOUNT : DiscountMode.NONE,
      discountValue: "0",
    });
  }, [updateRow]);

  const preview = useMemo(() => {
    let gross = new Prisma.Decimal(0);
    let discounts = new Prisma.Decimal(0);
    let net = new Prisma.Decimal(0);
    let lineCount = 0;

    const scope = step === "entry" ? selectedItemsOrdered : items;

    for (const item of scope) {
      const row = rows[item.id] ?? emptyRow();
      const qty = parseDecimalInput(row.monthQty.trim());
      if (!qty || qty.isZero()) {
        continue;
      }

      const unitPrice = parseDecimalInput(item.unitPriceValue);
      if (!unitPrice) {
        continue;
      }

      const monthGross = qty.mul(unitPrice);
      let discountAmount = new Prisma.Decimal(0);

      if (row.discountMode === DiscountMode.PERCENTAGE && row.discountValue.trim()) {
        const pct = parseDecimalInput(row.discountValue.trim());
        if (pct) {
          discountAmount = monthGross.mul(pct).div(100);
        }
      } else if (row.discountMode === DiscountMode.AMOUNT && row.discountValue.trim()) {
        const amount = parseDecimalInput(row.discountValue.trim());
        if (amount) {
          discountAmount = amount.greaterThan(monthGross) ? monthGross : amount;
        }
      } else if (row.discountMode === DiscountMode.QUANTITY && row.discountValue.trim()) {
        const dq = parseDecimalInput(row.discountValue.trim());
        if (dq) {
          const effective = dq.greaterThan(qty) ? qty : dq;
          discountAmount = effective.mul(unitPrice);
        }
      }

      const payable = monthGross.sub(discountAmount).lessThan(0)
        ? new Prisma.Decimal(0)
        : monthGross.sub(discountAmount);

      gross = gross.add(monthGross);
      discounts = discounts.add(discountAmount);
      net = net.add(payable);
      lineCount += 1;
    }

    return { gross, discounts, net, lineCount };
  }, [items, rows, selectedItemsOrdered, step]);

  function goToEntry() {
    setSelectionError(null);
    if (selectedIds.size === 0) {
      setSelectionError("Selecciona al menos una partida para continuar.");
      return;
    }
    setStep("entry");
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    setClientError(null);

    for (const item of selectedItemsOrdered) {
      const qty = parseDecimalInput((rows[item.id] ?? emptyRow()).monthQty.trim());
      if (!qty || qty.isZero()) {
        e.preventDefault();
        setClientError(
          `Indica cantidad del mes para todas las partidas elegidas (falta ${item.itemNumber} · ${item.itemCode}).`,
        );
        return;
      }
    }

    const payload: {
      itemCode: string;
      quantityConsumed: string;
      discountMode: string;
      discountValue: string;
      note: string;
    }[] = [];

    for (const item of selectedItemsOrdered) {
      const row = rows[item.id] ?? emptyRow();
      const qty = parseDecimalInput(row.monthQty.trim());
      if (!qty || qty.isZero()) {
        continue;
      }

      payload.push({
        itemCode: item.itemCode,
        quantityConsumed: row.monthQty.trim(),
        discountMode:
          row.discountMode === DiscountMode.NONE ? "" : row.discountMode,
        discountValue:
          row.discountMode === DiscountMode.NONE ? "0" : row.discountValue.trim() || "0",
        note: row.note.trim(),
      });
    }

    if (payload.length === 0) {
      e.preventDefault();
      setClientError("No hay lineas para enviar.");
      return;
    }

    if (!jsonFieldRef.current) {
      e.preventDefault();
      setClientError("No se pudo preparar el envio del formulario.");
      return;
    }

    jsonFieldRef.current.value = JSON.stringify(payload);

    if (
      isReplacingEdp &&
      !window.confirm(
        "Se reemplazara completamente el Estado de Pago del periodo. Las partidas quitadas seran eliminadas del cierre. ¿Deseas continuar?",
      )
    ) {
      e.preventDefault();
    }
  }

  if (items.length === 0) {
    return (
      <article className="rounded-[2rem] border border-dashed border-slate-300 bg-white p-7 shadow-[0_20px_50px_rgba(15,23,42,0.04)]">
        <h2 className="text-2xl font-semibold text-slate-950">Sin partidas cargadas</h2>
        <p className="mt-2 text-sm leading-7 text-slate-600">
          Carga el itemizado del contrato {contractCode} antes de registrar un estado de pago.
        </p>
        <Link
          href={`/contracts/${contractId}/items`}
          className="mt-4 inline-block text-sm font-medium text-teal-700 transition hover:text-teal-900"
        >
          Ir a partidas
        </Link>
      </article>
    );
  }

  const filteredIds = filteredForSelect.map((i) => i.id);
  const allFilteredSelected =
    filteredIds.length > 0 && filteredIds.every((id) => selectedIds.has(id));

  return (
    <article className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-[0_20px_50px_rgba(15,23,42,0.06)]">
      <h2 className="text-2xl font-semibold text-slate-950">
        {isReplacingEdp ? "Reemplazo del Estado de Pago" : "Registrar estado de pago"}
      </h2>
      <p className="mt-2 text-sm leading-7 text-slate-600">
        {isReplacingEdp
          ? "Ajusta las partidas incluidas, cantidades, descuentos y notas del EDP seleccionado."
          : step === "select"
            ? "Elige las partidas que tendran movimiento en este EP. En el siguiente paso ingresaras cantidades y descuentos solo para ellas."
            : "Completa periodo, montos y descuentos. Solo se envian las partidas que elegiste en el paso anterior."}
      </p>
      {isReplacingEdp ? (
        <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
          Esta accion reemplaza completamente el Estado de Pago del periodo. Las partidas quitadas seran eliminadas del cierre.
        </p>
      ) : null}

      <ol
        className="mt-6 flex flex-wrap gap-4 text-sm font-medium"
        aria-label="Pasos del registro"
      >
        <li
          className={`flex items-center gap-2 rounded-full px-4 py-2 ${
            step === "select"
              ? "bg-slate-950 text-white"
              : "border border-slate-200 bg-slate-50 text-slate-700"
          }`}
        >
          <span className="font-mono text-xs opacity-80">1</span>
          Elegir partidas
        </li>
        <li className="self-center text-slate-400" aria-hidden>
          →
        </li>
        <li
          className={`flex items-center gap-2 rounded-full px-4 py-2 ${
            step === "entry"
              ? "bg-slate-950 text-white"
              : "border border-slate-200 bg-slate-50 text-slate-700"
          }`}
        >
          <span className="font-mono text-xs opacity-80">2</span>
          Ingresar datos
        </li>
      </ol>

      {step === "select" ? (
        <section className="mt-8 space-y-5" aria-labelledby="step-select-heading">
          <h3 id="step-select-heading" className="sr-only">
            Paso 1: seleccion de partidas
          </h3>

          <section
            aria-label="Datos del estado de pago"
            className="rounded-2xl border border-teal-100 bg-teal-50/60 px-5 py-4"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-900">
              Datos del estado de pago
            </p>
            <p className="mt-1 text-xs text-teal-900">
              Si dejas el numero vacio, se asigna automaticamente como EDP correlativo (EDP1, EDP2, ...).
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700" htmlFor="select-ep-year">
                  Año
                </label>
                <input
                  id="select-ep-year"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  placeholder="2026"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0f766e] focus:ring-4 focus:ring-[#99f6e4]"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700" htmlFor="select-ep-month">
                  Mes
                </label>
                <input
                  id="select-ep-month"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  placeholder="3"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0f766e] focus:ring-4 focus:ring-[#99f6e4]"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700" htmlFor="select-ep-stmt">
                  Estado de pago (numero)
                </label>
                <input
                  id="select-ep-stmt"
                  value={statementNumber}
                  onChange={(e) => setStatementNumber(e.target.value)}
                  placeholder="Se asigna automatico (EDP#)"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0f766e] focus:ring-4 focus:ring-[#99f6e4]"
                />
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <label className="block text-sm font-medium text-slate-700" htmlFor="select-ep-summary">
                Resumen u observaciones
              </label>
              <input
                id="select-ep-summary"
                value={summaryNote}
                onChange={(e) => setSummaryNote(e.target.value)}
                placeholder="Observaciones generales del cierre"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0f766e] focus:ring-4 focus:ring-[#99f6e4]"
              />
            </div>
          </section>

          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0 flex-1 space-y-2">
              <label className="block text-sm font-medium text-slate-700" htmlFor="ep-filter">
                Buscar en itemizado
              </label>
              <input
                id="ep-filter"
                type="search"
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                placeholder="Numero, codigo o texto de la descripcion"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0f766e] focus:ring-4 focus:ring-[#99f6e4]"
              />
            </div>
            <p className="shrink-0 text-sm text-slate-600">
              <span className="font-semibold text-slate-950">{selectedCount}</span> de{" "}
              {items.length} partidas seleccionadas
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => selectIds(filteredIds, "add")}
              disabled={filteredIds.length === 0}
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 transition hover:border-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Seleccionar filtradas ({filteredIds.length})
            </button>
            <button
              type="button"
              onClick={() => selectIds(filteredIds, "remove")}
              disabled={filteredIds.length === 0}
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 transition hover:border-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Quitar filtradas
            </button>
            <button
              type="button"
              onClick={() => selectIds(items.map((i) => i.id), "add")}
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 transition hover:border-slate-900"
            >
              Seleccionar todas
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 transition hover:border-slate-900"
            >
              Limpiar seleccion
            </button>
            <label className="flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-medium text-slate-800">
              <input
                type="checkbox"
                checked={allFilteredSelected && filteredIds.length > 0}
                onChange={(e) => {
                  if (e.target.checked) {
                    selectIds(filteredIds, "add");
                  } else {
                    selectIds(filteredIds, "remove");
                  }
                }}
                className="size-4 rounded border-slate-300 text-[#0f766e] focus:ring-[#99f6e4]"
              />
              Marcar / desmarcar solo vista actual
            </label>
          </div>

          {selectionError ? (
            <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
              {selectionError}
            </p>
          ) : null}

          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-[48rem] w-full border-collapse text-left text-sm">
              <thead className="sticky top-0 z-10 bg-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="w-12 px-3 py-3" scope="col">
                    <span className="sr-only">Incluir</span>
                  </th>
                  <th className="px-3 py-3">Item</th>
                  <th className="px-3 py-3">Descripcion</th>
                  <th className="px-3 py-3">UM</th>
                  <th className="px-3 py-3 text-right">P.U.</th>
                  <th className="px-3 py-3 text-right">Cant. contrato</th>
                  <th className="px-3 py-3 text-right">Avance acum.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white text-slate-900">
                {filteredForSelect.map((item) => {
                  const checked = selectedIds.has(item.id);
                  return (
                    <tr key={item.id} className="align-middle hover:bg-slate-50/80">
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => toggleOne(item.id, e.target.checked)}
                          aria-label={`Incluir partida ${item.itemNumber}`}
                          className="size-4 rounded border-slate-300 text-[#0f766e] focus:ring-[#99f6e4]"
                        />
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">
                        <span className="font-semibold text-slate-950">{item.itemNumber}</span>
                        <span className="block text-slate-500">{item.itemCode}</span>
                      </td>
                      <td className="max-w-md px-3 py-2 text-xs leading-snug text-slate-700">
                        {item.description}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-600">
                        {item.unit ?? "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right text-xs text-slate-600">
                        {item.unitPriceValue}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right text-xs text-slate-600">
                        {item.originalQuantityValue}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right text-xs text-slate-600">
                        {item.consumedQuantity}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filteredForSelect.length === 0 ? (
            <p className="text-center text-sm text-slate-600">
              Ninguna partida coincide con la busqueda. Prueba otro termino o borra el filtro.
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={goToEntry}
              className="rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Continuar a ingreso de datos
            </button>
          </div>
        </section>
      ) : null}

      {step === "entry" ? (
        <>
          <div className="mt-8">
            <button
              type="button"
              onClick={() => {
                setStep("select");
                setClientError(null);
              }}
              className="text-sm font-medium text-teal-800 underline-offset-4 transition hover:text-teal-950 hover:underline"
            >
              ← Volver a elegir partidas
            </button>
            <p className="mt-2 text-xs text-slate-600">
              Editando {selectedItemsOrdered.length} partida
              {selectedItemsOrdered.length === 1 ? "" : "s"} seleccionada
              {selectedItemsOrdered.length === 1 ? "" : "s"}.
            </p>
            <p className="mt-1 text-xs text-slate-600">
              EDP: <span className="font-semibold text-slate-900">{statementNumber || "automatico (EDP#)"}</span>
            </p>
          </div>

          <form
            action="/api/monthly-closures"
            method="post"
            className="mt-6 space-y-6"
            onSubmit={handleSubmit}
          >
            <input type="hidden" name="contractId" value={contractId} />
            {initialEdit ? <input type="hidden" name="closureId" value={initialEdit.closureId} /> : null}
            <input type="hidden" name="redirectTo" value={redirectTo} />
            <input type="hidden" name="closureInputMode" value="grid" />
            <input ref={jsonFieldRef} type="hidden" name="closureRowsJson" defaultValue="" />

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700" htmlFor="ep-year">
                  Año
                </label>
                <input
                  id="ep-year"
                  name="year"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  placeholder="2026"
                  required
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0f766e] focus:ring-4 focus:ring-[#99f6e4]"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700" htmlFor="ep-month">
                  Mes
                </label>
                <input
                  id="ep-month"
                  name="month"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  placeholder="3"
                  required
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0f766e] focus:ring-4 focus:ring-[#99f6e4]"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700" htmlFor="ep-stmt">
                  Estado de pago (número)
                </label>
                <input
                  id="ep-stmt"
                  name="statementNumber"
                  value={statementNumber}
                  onChange={(e) => setStatementNumber(e.target.value)}
                  placeholder="EP-03"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0f766e] focus:ring-4 focus:ring-[#99f6e4]"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700" htmlFor="ep-summary">
                Resumen u observaciones
              </label>
              <input
                id="ep-summary"
                name="summaryNote"
                value={summaryNote}
                onChange={(e) => setSummaryNote(e.target.value)}
                placeholder="Observaciones generales del cierre"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0f766e] focus:ring-4 focus:ring-[#99f6e4]"
              />
            </div>

            {clientError ? (
              <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
                {clientError}
              </p>
            ) : null}

            <section
              aria-label="Vista previa de totales"
              className="rounded-2xl border border-teal-100 bg-teal-50/60 px-5 py-4"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-900">
                Vista previa (partidas elegidas)
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <div>
                  <p className="text-xs text-teal-800">Bruto mes</p>
                  <p className="text-lg font-semibold text-slate-950">
                    {formatMoneyPreview(preview.gross, currency)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-teal-800">Total descuentos del mes</p>
                  <p className="text-lg font-semibold text-slate-950">
                    {formatMoneyPreview(preview.discounts, currency)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-teal-800">Neto mes</p>
                  <p className="text-lg font-semibold text-slate-950">
                    {formatMoneyPreview(preview.net, currency)}
                  </p>
                </div>
              </div>
              <p className="mt-2 text-xs text-teal-900">
                {preview.lineCount} linea{preview.lineCount === 1 ? "" : "s"} con cantidad del mes
                cargada (de {selectedItemsOrdered.length} elegidas).
              </p>
            </section>

            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="min-w-[78rem] w-full border-collapse text-left text-sm">
                <thead className="sticky top-0 z-10 bg-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  <tr>
                    <th className="px-3 py-3">Item</th>
                    <th className="px-3 py-3">Descripción</th>
                    <th className="px-3 py-3">UM</th>
                    <th className="px-3 py-3 text-right">P.U.</th>
                    <th className="px-3 py-3 text-right">Cant. contrato</th>
                    <th className="px-3 py-3 text-right">Avance acum.</th>
                    <th className="px-3 py-3 text-right">Cant. mes</th>
                    <th className="px-3 py-3">Nota</th>
                    <th className="px-3 py-3">Descuento especial</th>
                    {isReplacingEdp ? (
                      <th className="px-3 py-3 text-right">Accion</th>
                    ) : null}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white text-slate-900">
                  {selectedItemsOrdered.map((item) => {
                    const row = rows[item.id] ?? emptyRow();
                    const hasDiscount = row.discountMode !== DiscountMode.NONE;
                    return (
                      <tr key={item.id} className="align-top hover:bg-slate-50/80">
                        <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">
                          <span className="font-semibold text-slate-950">{item.itemNumber}</span>
                          <span className="block text-slate-500">{item.itemCode}</span>
                        </td>
                        <td className="max-w-[14rem] px-3 py-2 text-xs leading-snug text-slate-700">
                          {item.description}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-600">
                          {item.unit ?? "—"}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-right text-xs text-slate-600">
                          {item.unitPriceValue}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-right text-xs text-slate-600">
                          {item.originalQuantityValue}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-right text-xs text-slate-600">
                          {item.consumedQuantity}
                        </td>
                        <td className="px-2 py-2">
                          <input
                            aria-label={`Cantidad del mes ${item.itemNumber}`}
                            value={row.monthQty}
                            onChange={(e) => updateRow(item.id, { monthQty: e.target.value })}
                            placeholder="0"
                            className="w-full min-w-[5.5rem] rounded-xl border border-slate-200 px-2 py-1.5 text-right font-mono text-xs outline-none focus:border-[#0f766e]"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            aria-label={`Nota ${item.itemNumber}`}
                            value={row.note}
                            onChange={(e) => updateRow(item.id, { note: e.target.value })}
                            placeholder="—"
                            className="w-full min-w-[8rem] rounded-xl border border-slate-200 px-2 py-1.5 text-xs outline-none focus:border-[#0f766e]"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <div className="min-w-[14rem] space-y-2">
                            <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700">
                              <input
                                type="checkbox"
                                checked={hasDiscount}
                                onChange={(e) => toggleDiscount(item.id, e.target.checked)}
                                className="size-4 rounded border-slate-300 text-[#0f766e] focus:ring-[#99f6e4]"
                              />
                              Tiene descuento
                            </label>
                            {hasDiscount ? (
                              <div className="grid gap-2 sm:grid-cols-[1fr_7rem]">
                                <div className="space-y-1">
                                  <label
                                    className="block text-[11px] font-medium text-slate-500"
                                    htmlFor={`discount-mode-${item.id}`}
                                  >
                                    Tipo de descuento
                                  </label>
                                  <select
                                    id={`discount-mode-${item.id}`}
                                    aria-label={`Tipo de descuento ${item.itemNumber}`}
                                    value={row.discountMode}
                                    onChange={(e) => {
                                      const discountMode = e.target.value as DiscountMode;
                                      updateRow(item.id, {
                                        discountMode,
                                        discountValue:
                                          discountMode === DiscountMode.NONE ? "0" : row.discountValue || "0",
                                      });
                                    }}
                                    className="w-full rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-xs outline-none focus:border-[#0f766e]"
                                  >
                                    <option value={DiscountMode.NONE}>Sin descuento</option>
                                    <option value={DiscountMode.AMOUNT}>Descuento en $</option>
                                    <option value={DiscountMode.PERCENTAGE}>Descuento en %</option>
                                    <option value={DiscountMode.QUANTITY}>Descuento en cantidad</option>
                                  </select>
                                </div>
                                <div className="space-y-1">
                                  <label
                                    className="block text-[11px] font-medium text-slate-500"
                                    htmlFor={`discount-value-${item.id}`}
                                  >
                                    Monto / % descuento
                                  </label>
                                  <input
                                    id={`discount-value-${item.id}`}
                                    aria-label={`Monto o porcentaje descuento ${item.itemNumber}`}
                                    value={row.discountValue}
                                    onChange={(e) => updateRow(item.id, { discountValue: e.target.value })}
                                    placeholder={row.discountMode === DiscountMode.PERCENTAGE ? "%" : "0"}
                                    className="w-full rounded-xl border border-slate-200 px-2 py-1.5 text-right font-mono text-xs outline-none focus:border-[#0f766e]"
                                  />
                                </div>
                              </div>
                            ) : null}
                          </div>
                        </td>
                        {isReplacingEdp ? (
                          <td className="px-2 py-2 text-right">
                            <button
                              type="button"
                              onClick={() => removeSelectedItem(item.id)}
                              className="rounded-full border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:border-red-500 hover:text-red-800"
                            >
                              Quitar
                            </button>
                          </td>
                        ) : null}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap gap-3">
              {isReplacingEdp ? (
                <button
                  type="button"
                  onClick={() => {
                    setStep("select");
                    setClientError(null);
                  }}
                  className="rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 transition hover:border-slate-900"
                >
                  Agregar partida
                </button>
              ) : null}
              <button
                type="submit"
                className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                {isReplacingEdp ? "Reemplazar EDP" : "Guardar estado de pago"}
              </button>
            </div>
          </form>

          <details className="mt-8 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
            <summary className="cursor-pointer text-sm font-medium text-slate-800">
              Carga compacta por lineas (texto)
            </summary>
            <p className="mt-2 text-xs leading-6 text-slate-600">
              Formato por linea:{" "}
              <code className="rounded bg-white px-1 py-0.5 text-[11px]">
                codigo|cantidadMes|modoDescuento|valorDescuento|nota
              </code>
              . Modos: AMOUNT, PERCENTAGE, QUANTITY o vacio.
            </p>
            <form
              action="/api/monthly-closures"
              method="post"
              className="mt-4 space-y-4"
              onSubmit={(event) => {
                if (
                  isReplacingEdp &&
                  !window.confirm(
                    "Se reemplazara completamente el Estado de Pago del periodo. Las partidas quitadas seran eliminadas del cierre. ¿Deseas continuar?",
                  )
                ) {
                  event.preventDefault();
                }
              }}
            >
              <input type="hidden" name="contractId" value={contractId} />
              {initialEdit ? <input type="hidden" name="closureId" value={initialEdit.closureId} /> : null}
              <input type="hidden" name="redirectTo" value={redirectTo} />
              <input type="hidden" name="closureInputMode" value="text" />
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-slate-700" htmlFor="legacy-year">
                    Año
                  </label>
                  <input
                    id="legacy-year"
                    name="year"
                    defaultValue={year}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-slate-700" htmlFor="legacy-month">
                    Mes
                  </label>
                  <input
                    id="legacy-month"
                    name="month"
                    defaultValue={month}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-slate-700" htmlFor="legacy-stmt">
                    EP
                  </label>
                  <input
                    id="legacy-stmt"
                    name="statementNumber"
                    defaultValue={statementNumber}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-700" htmlFor="legacy-summary">
                  Resumen
                </label>
                <input
                  id="legacy-summary"
                  name="summaryNote"
                  defaultValue={summaryNote}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                />
              </div>
              <textarea
                id="legacy-rows"
                name="rows"
                required
                rows={6}
                placeholder="1.1|120|QUANTITY|10|Descuento"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-xs"
              />
              <button
                type="submit"
                className="rounded-full border border-slate-400 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100"
              >
                {isReplacingEdp ? "Reemplazar via texto" : "Guardar via texto"}
              </button>
            </form>
          </details>
        </>
      ) : null}
    </article>
  );
}
