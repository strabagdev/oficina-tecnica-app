import "server-only";

import {
  ChangeStatus,
  ContractForecastLineKind,
  ContractForecastLineSource,
  ContractForecastStatus,
  MonthlyClosureStatus,
  Prisma,
} from "@prisma/client";
import {
  formatCurrencyDisplay,
  formatDecimalDisplay,
  getMoneyScaleForCurrency,
  parseMoneyDecimal,
  roundMoneyForCurrency,
} from "@/lib/numeric";
import { getPrisma } from "@/lib/prisma";

type ForecastInputLine = {
  year: number;
  month: number;
  amount: string;
  source: ContractForecastLineSource;
};

export type ForecastMutationResult =
  | { error: string }
  | { success: string };

function monthKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function formatPeriod(year: number, month: number) {
  return `${String(month).padStart(2, "0")}/${year}`;
}

function nextMonth(year: number, month: number) {
  return month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
}

function comparePeriod(left: { year: number; month: number }, right: { year: number; month: number }) {
  return left.year === right.year ? left.month - right.month : left.year - right.year;
}

function buildFuturePeriods(
  start: { year: number; month: number },
  endDate: Date | null,
) {
  const end = endDate
    ? { year: endDate.getUTCFullYear(), month: endDate.getUTCMonth() + 1 }
    : null;
  const periods: Array<{ year: number; month: number }> = [];
  let cursor = start;
  const targetLength = end && comparePeriod(end, start) >= 0 ? 36 : 6;

  while (periods.length < targetLength) {
    periods.push(cursor);
    if (end && comparePeriod(cursor, end) >= 0) {
      break;
    }
    cursor = nextMonth(cursor.year, cursor.month);
  }

  return periods;
}

function moneyUnits(value: Prisma.Decimal, currency: string) {
  const scale = getMoneyScaleForCurrency(currency);
  return value.mul(new Prisma.Decimal(10).pow(scale)).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP);
}

function fromMoneyUnits(value: Prisma.Decimal, currency: string) {
  const scale = getMoneyScaleForCurrency(currency);
  return value.div(new Prisma.Decimal(10).pow(scale)).toDecimalPlaces(scale, Prisma.Decimal.ROUND_HALF_UP);
}

function distributeMoney(
  amount: Prisma.Decimal,
  count: number,
  currency: string,
) {
  if (count <= 0) {
    return [];
  }

  const totalUnits = moneyUnits(amount, currency);
  const baseUnits = totalUnits.div(count).floor();
  const remainder = totalUnits.sub(baseUnits.mul(count)).toNumber();

  return Array.from({ length: count }, (_, index) =>
    fromMoneyUnits(baseUnits.add(index < remainder ? 1 : 0), currency),
  );
}

function sumDecimals(values: Prisma.Decimal[]) {
  return values.reduce((total, value) => total.add(value), new Prisma.Decimal(0));
}

function estimateClose(lines: Array<{ year: number; month: number; amount: Prisma.Decimal }>) {
  const active = lines
    .filter((line) => line.amount.greaterThan(0))
    .sort((left, right) => comparePeriod(left, right));

  return active.at(-1) ?? null;
}

async function getForecastBasis(contractId: string) {
  const prisma = getPrisma();
  const contract = await prisma.contract.findUnique({
    where: {
      id: contractId,
    },
    include: {
      changes: {
        where: {
          status: ChangeStatus.APPLIED,
        },
        select: {
          amountDelta: true,
        },
      },
      monthlyClosures: {
        where: {
          status: MonthlyClosureStatus.CLOSED,
        },
        orderBy: [{ year: "asc" }, { month: "asc" }, { version: "asc" }],
        select: {
          id: true,
          year: true,
          month: true,
          statementNumber: true,
          netAmount: true,
        },
      },
    },
  });

  if (!contract) {
    return null;
  }

  const currentContractAmount = roundMoneyForCurrency(
    contract.originalAmount.add(
      sumDecimals(contract.changes.map((change) => change.amountDelta ?? new Prisma.Decimal(0))),
    ),
    contract.currency,
  );
  const officialPeriods = contract.monthlyClosures.map((closure) => ({
    year: closure.year,
    month: closure.month,
  }));
  const consumptions = officialPeriods.length > 0
    ? await prisma.monthlyConsumption.findMany({
        where: {
          contractItem: {
            contractId,
          },
          OR: officialPeriods,
        },
        select: {
          year: true,
          month: true,
          amountConsumed: true,
          payableAmount: true,
        },
      })
    : [];
  const edpAccumulatedAmount = roundMoneyForCurrency(
    sumDecimals(consumptions.map((consumption) => consumption.payableAmount ?? consumption.amountConsumed)),
    contract.currency,
  );
  const realAmountByPeriod = new Map<string, Prisma.Decimal>();

  for (const consumption of consumptions) {
    const key = monthKey(consumption.year, consumption.month);
    const current = realAmountByPeriod.get(key) ?? new Prisma.Decimal(0);
    realAmountByPeriod.set(
      key,
      roundMoneyForCurrency(
        current.add(consumption.payableAmount ?? consumption.amountConsumed),
        contract.currency,
      ),
    );
  }

  const latestClosure = contract.monthlyClosures.at(-1) ?? null;
  const forecastStart = latestClosure
    ? nextMonth(latestClosure.year, latestClosure.month)
    : contract.startDate
      ? { year: contract.startDate.getUTCFullYear(), month: contract.startDate.getUTCMonth() + 1 }
      : { year: new Date().getFullYear(), month: new Date().getMonth() + 1 };
  const remainingAmount = roundMoneyForCurrency(
    currentContractAmount.sub(edpAccumulatedAmount),
    contract.currency,
  );

  return {
    contract,
    currentContractAmount,
    edpAccumulatedAmount,
    remainingAmount,
    latestClosure,
    forecastStart,
    realAmountByPeriod,
  };
}

function buildDefaultForecastLines(
  periods: Array<{ year: number; month: number }>,
  remainingAmount: Prisma.Decimal,
  currency: string,
) {
  const distributed = distributeMoney(remainingAmount, periods.length, currency);

  return periods.map((period, index) => ({
    ...period,
    kind: ContractForecastLineKind.FORECAST,
    source: ContractForecastLineSource.AUTO,
    locked: false,
    amount: distributed[index] ?? new Prisma.Decimal(0),
  }));
}

export async function getContractForecastWorkspace(contractId: string) {
  const basis = await getForecastBasis(contractId);

  if (!basis) {
    return null;
  }

  const prisma = getPrisma();
  const [draft, approvedForecasts, snapshots] = await Promise.all([
    prisma.contractForecast.findFirst({
      where: {
        contractId,
        status: ContractForecastStatus.DRAFT,
      },
      orderBy: {
        version: "desc",
      },
      include: {
        lines: {
          orderBy: [{ year: "asc" }, { month: "asc" }],
        },
      },
    }),
    prisma.contractForecast.findMany({
      where: {
        contractId,
        status: {
          in: [
            ContractForecastStatus.APPROVED,
            ContractForecastStatus.OUTDATED,
            ContractForecastStatus.ARCHIVED,
          ],
        },
      },
      orderBy: {
        version: "desc",
      },
      take: 5,
    }),
    prisma.contractForecastSnapshot.findMany({
      where: {
        contractId,
      },
      orderBy: {
        approvedAt: "desc",
      },
      take: 5,
      include: {
        lines: {
          orderBy: [{ year: "asc" }, { month: "asc" }],
        },
      },
    }),
  ]);
  const futurePeriods = buildFuturePeriods(basis.forecastStart, basis.contract.endDate);
  const forecastLines = draft?.lines.length
    ? draft.lines
    : buildDefaultForecastLines(
        futurePeriods,
        basis.remainingAmount.lessThan(0) ? new Prisma.Decimal(0) : basis.remainingAmount,
        basis.contract.currency,
      );
  const realLines = basis.contract.monthlyClosures.map((closure) => ({
    year: closure.year,
    month: closure.month,
    statementNumber: closure.statementNumber ?? "Sin numero",
    amount: basis.realAmountByPeriod.get(monthKey(closure.year, closure.month)) ?? new Prisma.Decimal(0),
  }));
  const totalForecastAmount = roundMoneyForCurrency(
    sumDecimals(forecastLines.map((line) => line.amount)),
    basis.contract.currency,
  );
  const differenceAmount = roundMoneyForCurrency(
    totalForecastAmount.sub(basis.remainingAmount),
    basis.contract.currency,
  );
  const estimatedClose = estimateClose(forecastLines);

  return {
    contract: {
      id: basis.contract.id,
      code: basis.contract.code,
      name: basis.contract.name,
      clientName: basis.contract.clientName,
      status: basis.contract.status,
      currency: basis.contract.currency,
    },
    draft: draft
      ? {
          id: draft.id,
          status: draft.status,
          version: draft.version,
        }
      : null,
    metrics: {
      currentContractAmount: formatCurrencyDisplay(basis.currentContractAmount),
      edpAccumulatedAmount: formatCurrencyDisplay(basis.edpAccumulatedAmount),
      remainingAmount: formatCurrencyDisplay(basis.remainingAmount),
      totalForecastAmount: formatCurrencyDisplay(totalForecastAmount),
      differenceAmount: formatCurrencyDisplay(differenceAmount),
      closingEstimateAmount: formatCurrencyDisplay(basis.edpAccumulatedAmount.add(totalForecastAmount)),
      estimatedCloseLabel: estimatedClose ? formatPeriod(estimatedClose.year, estimatedClose.month) : "Sin forecast",
      remainingAmountValue: basis.remainingAmount.toFixed(getMoneyScaleForCurrency(basis.contract.currency)),
      differenceAmountValue: differenceAmount.toFixed(getMoneyScaleForCurrency(basis.contract.currency)),
    },
    basis: {
      startYear: basis.forecastStart.year,
      startMonth: basis.forecastStart.month,
      lastClosedYear: basis.latestClosure?.year ?? null,
      lastClosedMonth: basis.latestClosure?.month ?? null,
    },
    realLines: realLines.map((line) => ({
      ...line,
      periodLabel: formatPeriod(line.year, line.month),
      amountLabel: formatCurrencyDisplay(line.amount),
    })),
    forecastLines: forecastLines.map((line) => ({
      year: line.year,
      month: line.month,
      periodLabel: formatPeriod(line.year, line.month),
      amountValue: line.amount.toFixed(getMoneyScaleForCurrency(basis.contract.currency)),
      amountLabel: formatCurrencyDisplay(line.amount),
      source: line.source,
    })),
    approvedForecasts: approvedForecasts.map((forecast) => ({
      id: forecast.id,
      version: forecast.version,
      status: forecast.status,
      totalForecastAmount: formatCurrencyDisplay(forecast.totalForecastAmount),
      differenceAmount: formatCurrencyDisplay(forecast.differenceAmount),
      approvedAt: forecast.approvedAt
        ? new Intl.DateTimeFormat("es-CL", { dateStyle: "medium", timeStyle: "short" }).format(forecast.approvedAt)
        : "Sin aprobar",
    })),
    snapshots: snapshots.map((snapshot) => ({
      id: snapshot.id,
      version: snapshot.version,
      approvedAt: new Intl.DateTimeFormat("es-CL", { dateStyle: "medium", timeStyle: "short" }).format(snapshot.approvedAt),
      totalForecastAmount: formatCurrencyDisplay(snapshot.totalForecastAmount),
      differenceAmount: formatCurrencyDisplay(snapshot.differenceAmount),
      estimatedCloseLabel: snapshot.estimatedCloseYear && snapshot.estimatedCloseMonth
        ? formatPeriod(snapshot.estimatedCloseYear, snapshot.estimatedCloseMonth)
        : "Sin forecast",
    })),
  };
}

function parseForecastLines(raw: string, currency: string): { error: string } | { lines: ForecastInputLine[] } {
  try {
    const parsed = JSON.parse(raw) as Array<Partial<ForecastInputLine>>;

    if (!Array.isArray(parsed) || parsed.length === 0) {
      return { error: "Agrega al menos un mes forecast." };
    }

    const lines: ForecastInputLine[] = [];
    const seen = new Set<string>();

    for (const [index, line] of parsed.entries()) {
      const year = Number(line.year);
      const month = Number(line.month);
      const amount = String(line.amount ?? "").trim();
      const source = line.source === ContractForecastLineSource.MANUAL
        ? ContractForecastLineSource.MANUAL
        : ContractForecastLineSource.AUTO;

      if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
        return { error: `Periodo forecast invalido en la linea ${index + 1}.` };
      }

      const parsedAmount = parseMoneyDecimal(amount, { scale: getMoneyScaleForCurrency(currency) });

      if (!parsedAmount) {
        return { error: `Monto forecast invalido en ${formatPeriod(year, month)}.` };
      }

      if (parsedAmount.lessThan(0)) {
        return { error: `El forecast de ${formatPeriod(year, month)} no puede ser negativo.` };
      }

      const key = monthKey(year, month);
      if (seen.has(key)) {
        return { error: `El periodo ${formatPeriod(year, month)} esta repetido.` };
      }

      seen.add(key);
      lines.push({
        year,
        month,
        amount: roundMoneyForCurrency(parsedAmount, currency).toFixed(getMoneyScaleForCurrency(currency)),
        source,
      });
    }

    return { lines };
  } catch {
    return { error: "No pude leer las lineas de forecast." };
  }
}

export async function saveContractForecastFromForm(formData: FormData): Promise<ForecastMutationResult> {
  const contractId = String(formData.get("contractId") ?? "").trim();
  const linesJson = String(formData.get("linesJson") ?? "").trim();

  if (!contractId) {
    return { error: "Contrato no valido para forecast." };
  }

  const basis = await getForecastBasis(contractId);

  if (!basis) {
    return { error: "No encontre el contrato seleccionado." };
  }

  const parsedLines = parseForecastLines(linesJson, basis.contract.currency);

  if ("error" in parsedLines) {
    return parsedLines;
  }

  const prisma = getPrisma();
  const lineAmounts = parsedLines.lines.map((line) =>
    parseMoneyDecimal(line.amount, { scale: getMoneyScaleForCurrency(basis.contract.currency) }) ?? new Prisma.Decimal(0),
  );
  const totalForecastAmount = roundMoneyForCurrency(
    sumDecimals(lineAmounts),
    basis.contract.currency,
  );
  const differenceAmount = roundMoneyForCurrency(
    totalForecastAmount.sub(basis.remainingAmount),
    basis.contract.currency,
  );
  const estimatedClose = estimateClose(parsedLines.lines.map((line, index) => ({
    year: line.year,
    month: line.month,
    amount: lineAmounts[index] ?? new Prisma.Decimal(0),
  })));
  const existingDraft = await prisma.contractForecast.findFirst({
    where: {
      contractId,
      status: ContractForecastStatus.DRAFT,
    },
    orderBy: {
      version: "desc",
    },
    select: {
      id: true,
      version: true,
    },
  });
  const nextVersion = existingDraft?.version ??
    ((await prisma.contractForecast.aggregate({
      where: { contractId },
      _max: { version: true },
    }))._max.version ?? 0) + 1;

  await prisma.$transaction(async (tx) => {
    const forecast = existingDraft
      ? await tx.contractForecast.update({
          where: { id: existingDraft.id },
          data: {
            startYear: basis.forecastStart.year,
            startMonth: basis.forecastStart.month,
            lastClosedYear: basis.latestClosure?.year ?? null,
            lastClosedMonth: basis.latestClosure?.month ?? null,
            currentContractAmount: basis.currentContractAmount,
            edpAccumulatedAmount: basis.edpAccumulatedAmount,
            remainingAmount: basis.remainingAmount,
            totalForecastAmount,
            differenceAmount,
            estimatedCloseYear: estimatedClose?.year ?? null,
            estimatedCloseMonth: estimatedClose?.month ?? null,
          },
        })
      : await tx.contractForecast.create({
          data: {
            contractId,
            version: nextVersion,
            status: ContractForecastStatus.DRAFT,
            startYear: basis.forecastStart.year,
            startMonth: basis.forecastStart.month,
            lastClosedYear: basis.latestClosure?.year ?? null,
            lastClosedMonth: basis.latestClosure?.month ?? null,
            currentContractAmount: basis.currentContractAmount,
            edpAccumulatedAmount: basis.edpAccumulatedAmount,
            remainingAmount: basis.remainingAmount,
            totalForecastAmount,
            differenceAmount,
            estimatedCloseYear: estimatedClose?.year ?? null,
            estimatedCloseMonth: estimatedClose?.month ?? null,
          },
        });

    await tx.contractForecastLine.deleteMany({
      where: { forecastId: forecast.id },
    });
    await tx.contractForecastLine.createMany({
      data: parsedLines.lines.map((line, index) => ({
        forecastId: forecast.id,
        year: line.year,
        month: line.month,
        kind: ContractForecastLineKind.FORECAST,
        source: line.source,
        amount: lineAmounts[index] ?? new Prisma.Decimal(0),
        locked: false,
      })),
    });
  });

  return { success: "Forecast guardado como borrador." };
}

export async function approveContractForecastFromForm(formData: FormData): Promise<ForecastMutationResult> {
  const contractId = String(formData.get("contractId") ?? "").trim();
  const forecastId = String(formData.get("forecastId") ?? "").trim();
  const confirmMismatch = String(formData.get("confirmMismatch") ?? "") === "1";

  if (!contractId || !forecastId) {
    return { error: "Forecast no valido para aprobar." };
  }

  const prisma = getPrisma();
  const forecast = await prisma.contractForecast.findFirst({
    where: {
      id: forecastId,
      contractId,
      status: ContractForecastStatus.DRAFT,
    },
    include: {
      lines: {
        orderBy: [{ year: "asc" }, { month: "asc" }],
      },
    },
  });

  if (!forecast) {
    return { error: "Solo puedes aprobar un forecast en borrador." };
  }

  if (!forecast.differenceAmount.isZero() && !confirmMismatch) {
    return {
      error:
        `El forecast no cuadra con el saldo vigente. Diferencia ${formatCurrencyDisplay(forecast.differenceAmount)}. Marca la confirmacion para aprobar con diferencia.`,
    };
  }

  const approvedAt = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.contractForecast.updateMany({
      where: {
        contractId,
        status: ContractForecastStatus.APPROVED,
      },
      data: {
        status: ContractForecastStatus.ARCHIVED,
        archivedAt: approvedAt,
      },
    });
    await tx.contractForecast.update({
      where: { id: forecast.id },
      data: {
        status: ContractForecastStatus.APPROVED,
        approvedAt,
      },
    });
    const snapshot = await tx.contractForecastSnapshot.create({
      data: {
        contractId,
        forecastId: forecast.id,
        version: forecast.version,
        status: ContractForecastStatus.APPROVED,
        startYear: forecast.startYear,
        startMonth: forecast.startMonth,
        lastClosedYear: forecast.lastClosedYear,
        lastClosedMonth: forecast.lastClosedMonth,
        currentContractAmount: forecast.currentContractAmount,
        edpAccumulatedAmount: forecast.edpAccumulatedAmount,
        remainingAmount: forecast.remainingAmount,
        totalForecastAmount: forecast.totalForecastAmount,
        differenceAmount: forecast.differenceAmount,
        estimatedCloseYear: forecast.estimatedCloseYear,
        estimatedCloseMonth: forecast.estimatedCloseMonth,
        approvedAt,
      },
    });
    await tx.contractForecastSnapshotLine.createMany({
      data: forecast.lines.map((line) => ({
        snapshotId: snapshot.id,
        year: line.year,
        month: line.month,
        kind: line.kind,
        source: line.source,
        amount: line.amount,
        locked: line.locked,
      })),
    });
  });

  return { success: "Forecast aprobado y snapshot generado." };
}

export function formatForecastQuantity(value: Prisma.Decimal | string | number | null | undefined) {
  return formatDecimalDisplay(value, { scale: 3, trimTrailingZeros: true });
}
