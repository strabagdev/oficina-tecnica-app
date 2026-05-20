"use client";

import { ContractForecastLineSource, Prisma } from "@prisma/client";
import { useMemo, useState } from "react";
import { getMoneyScaleForCurrency, parseMoneyDecimal } from "@/lib/numeric";

export type ForecastEditorLine = {
  year: number;
  month: number;
  periodLabel: string;
  amountValue: string;
  source: ContractForecastLineSource;
};

export type ForecastRealLine = {
  year: number;
  month: number;
  periodLabel: string;
  statementNumber: string;
  amountLabel: string;
};

function formatMoney(value: Prisma.Decimal, currency: string) {
  const scale = getMoneyScaleForCurrency(currency);
  const fixed = value.toFixed(scale);
  const n = Number(fixed);

  try {
    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: currency.length === 3 ? currency : "CLP",
      maximumFractionDigits: scale,
      minimumFractionDigits: scale,
    }).format(n);
  } catch {
    return `${currency} ${n.toLocaleString("es-CL")}`;
  }
}

function moneyUnits(value: Prisma.Decimal, currency: string) {
  const scale = getMoneyScaleForCurrency(currency);
  return value.mul(new Prisma.Decimal(10).pow(scale)).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP);
}

function fromMoneyUnits(value: Prisma.Decimal, currency: string) {
  const scale = getMoneyScaleForCurrency(currency);
  return value.div(new Prisma.Decimal(10).pow(scale)).toFixed(scale);
}

function distribute(value: Prisma.Decimal, count: number, currency: string) {
  if (count <= 0) {
    return [];
  }

  const totalUnits = moneyUnits(value, currency);
  const baseUnits = totalUnits.div(count).floor();
  const remainder = totalUnits.sub(baseUnits.mul(count)).toNumber();

  return Array.from({ length: count }, (_, index) =>
    fromMoneyUnits(baseUnits.add(index < remainder ? 1 : 0), currency),
  );
}

function parseAmount(value: string, currency: string) {
  return parseMoneyDecimal(value, { scale: getMoneyScaleForCurrency(currency) }) ?? new Prisma.Decimal(0);
}

export function ContractForecastEditorClient({
  contractId,
  redirectTo,
  currency,
  remainingAmountValue,
  draftId,
  realLines,
  initialLines,
  canEdit,
}: {
  contractId: string;
  redirectTo: string;
  currency: string;
  remainingAmountValue: string;
  draftId: string | null;
  realLines: ForecastRealLine[];
  initialLines: ForecastEditorLine[];
  canEdit: boolean;
}) {
  const [lines, setLines] = useState<ForecastEditorLine[]>(initialLines);
  const [confirmMismatch, setConfirmMismatch] = useState(false);
  const remainingAmount = useMemo(
    () => parseAmount(remainingAmountValue, currency),
    [currency, remainingAmountValue],
  );

  const totals = useMemo(() => {
    const total = lines.reduce(
      (accumulator, line) => accumulator.add(parseAmount(line.amountValue, currency)),
      new Prisma.Decimal(0),
    );
    const difference = total.sub(remainingAmount);
    const estimatedClose = [...lines]
      .filter((line) => parseAmount(line.amountValue, currency).greaterThan(0))
      .at(-1);

    return {
      total,
      difference,
      estimatedClose,
    };
  }, [currency, lines, remainingAmount]);
  const linesJson = useMemo(
    () =>
      JSON.stringify(
        lines.map((line) => ({
          year: line.year,
          month: line.month,
          amount: line.amountValue,
          source: line.source,
        })),
      ),
    [lines],
  );

  function redistribute(nextLines: ForecastEditorLine[]) {
    const manualTotal = nextLines
      .filter((line) => line.source === ContractForecastLineSource.MANUAL)
      .reduce((total, line) => total.add(parseAmount(line.amountValue, currency)), new Prisma.Decimal(0));
    const autoIndexes = nextLines
      .map((line, index) => (line.source === ContractForecastLineSource.AUTO ? index : -1))
      .filter((index) => index >= 0);
    const autoBudget = remainingAmount.sub(manualTotal).lessThan(0)
      ? new Prisma.Decimal(0)
      : remainingAmount.sub(manualTotal);
    const values = distribute(autoBudget, autoIndexes.length, currency);

    return nextLines.map((line, index) => {
      const autoPosition = autoIndexes.indexOf(index);
      return autoPosition >= 0 ? { ...line, amountValue: values[autoPosition] ?? "0" } : line;
    });
  }

  function setManualAmount(index: number, value: string) {
    setLines((current) =>
      redistribute(
        current.map((line, lineIndex) =>
          lineIndex === index
            ? { ...line, amountValue: value, source: ContractForecastLineSource.MANUAL }
            : line,
        ),
      ),
    );
  }

  function resetAuto() {
    setLines((current) =>
      redistribute(
        current.map((line) => ({
          ...line,
          source: ContractForecastLineSource.AUTO,
        })),
      ),
    );
  }

  const hasDifference = !totals.difference.isZero();

  return (
    <div className="space-y-4">
      <article className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.05)]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">Curva contractual</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Los meses reales vienen de EDP oficiales. Los meses forecast proyectan solo saldo contractual.
            </p>
          </div>
          {canEdit ? (
            <button
              type="button"
              onClick={resetAuto}
              className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800 transition hover:border-slate-900 hover:text-slate-950"
            >
              Generar automatico
            </button>
          ) : null}
        </div>

        <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-100">
          <table className="min-w-[44rem] w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-[0.14em] text-slate-500">
              <tr>
                <th className="px-4 py-3">Periodo</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Origen</th>
                <th className="px-4 py-3 text-right">Monto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {realLines.map((line) => (
                <tr key={`real-${line.year}-${line.month}`} className="bg-slate-50/60">
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-950">
                    {line.periodLabel}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full border border-teal-100 bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-800">
                      REAL
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{line.statementNumber}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-slate-950">
                    {line.amountLabel}
                  </td>
                </tr>
              ))}
              {lines.map((line, index) => (
                <tr key={`forecast-${line.year}-${line.month}`}>
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-950">
                    {line.periodLabel}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full border border-sky-100 bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-800">
                      FORECAST
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                        line.source === ContractForecastLineSource.MANUAL
                          ? "border-amber-100 bg-amber-50 text-amber-800"
                          : "border-slate-200 bg-slate-50 text-slate-700"
                      }`}
                    >
                      {line.source}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <input
                      type="text"
                      inputMode="decimal"
                      disabled={!canEdit}
                      value={line.amountValue}
                      onChange={(event) => setManualAmount(index, event.target.value)}
                      className="w-40 rounded-xl border border-slate-200 px-3 py-2 text-right text-sm font-semibold text-slate-950 outline-none transition focus:border-teal-700 disabled:bg-slate-50 disabled:text-slate-500"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>

      <article className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.05)]">
        <div className="grid gap-3 md:grid-cols-4">
          <DataPill label="Forecast restante" value={formatMoney(totals.total, currency)} />
          <DataPill
            label="Diferencia"
            value={formatMoney(totals.difference, currency)}
            tone={hasDifference ? "amber" : "teal"}
          />
          <DataPill
            label="Mes cierre"
            value={totals.estimatedClose?.periodLabel ?? "Sin monto"}
          />
          <DataPill label="Modo" value={draftId ? "Borrador guardado" : "Simulacion"} />
        </div>

        {canEdit ? (
          <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={confirmMismatch}
                onChange={(event) => setConfirmMismatch(event.target.checked)}
                className="size-4 rounded border-slate-300 text-teal-700 focus:ring-teal-100"
              />
              Permitir aprobacion con diferencia contra saldo vigente
            </label>
            <div className="flex flex-wrap gap-2">
              <form action="/api/contract-forecasts" method="post">
                <input type="hidden" name="action" value="save" />
                <input type="hidden" name="contractId" value={contractId} />
                <input type="hidden" name="redirectTo" value={redirectTo} />
                <input type="hidden" name="linesJson" value={linesJson} readOnly />
                <button
                  type="submit"
                  className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-800 transition hover:border-slate-900 hover:text-slate-950"
                >
                  Guardar borrador
                </button>
              </form>
              <form action="/api/contract-forecasts" method="post">
                <input type="hidden" name="action" value="approve" />
                <input type="hidden" name="contractId" value={contractId} />
                <input type="hidden" name="forecastId" value={draftId ?? ""} />
                <input type="hidden" name="redirectTo" value={redirectTo} />
                <input type="hidden" name="confirmMismatch" value={confirmMismatch ? "1" : "0"} />
                <input type="hidden" name="linesJson" value={linesJson} readOnly />
                <button
                  type="submit"
                  disabled={!draftId || (hasDifference && !confirmMismatch)}
                  className="rounded-full bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  Aprobar forecast
                </button>
              </form>
            </div>
          </div>
        ) : null}
      </article>
    </div>
  );
}

function DataPill({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: string;
  tone?: "slate" | "teal" | "amber";
}) {
  const toneClass = {
    slate: "bg-slate-50 text-slate-950",
    teal: "bg-teal-50 text-teal-900",
    amber: "bg-amber-50 text-amber-900",
  }[tone];

  return (
    <div className={`rounded-2xl p-4 ${toneClass}`}>
      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-semibold">{value}</p>
    </div>
  );
}
