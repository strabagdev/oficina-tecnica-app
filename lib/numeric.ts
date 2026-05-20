import { Prisma } from "@prisma/client";

type DecimalLike = Prisma.Decimal | string | number | null | undefined;

const ZERO_DECIMAL_CURRENCIES = new Set(["CLP"]);

export function getMoneyScaleForCurrency(currency: string | null | undefined) {
  return ZERO_DECIMAL_CURRENCIES.has((currency ?? "").trim().toUpperCase()) ? 0 : 2;
}

export function normalizeDecimalInput(value: string) {
  const raw = value.trim().replace(/\s+/g, "").replace(/'/g, "");

  if (!raw) {
    return null;
  }

  const lastComma = raw.lastIndexOf(",");
  const lastDot = raw.lastIndexOf(".");
  const decimalSeparator =
    lastComma === -1 && lastDot === -1 ? null : lastComma > lastDot ? "," : ".";

  let normalized = raw;

  if (decimalSeparator === ",") {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else if (decimalSeparator === ".") {
    normalized = normalized.replace(/,/g, "");
  } else {
    normalized = normalized.replace(/[.,]/g, "");
  }

  if (!/^[+-]?\d+(\.\d+)?$/.test(normalized)) {
    return null;
  }

  return normalized;
}

export function parseDecimalInput(value: string) {
  const normalized = normalizeDecimalInput(value);

  if (!normalized) {
    return null;
  }

  try {
    return new Prisma.Decimal(normalized);
  } catch {
    return null;
  }
}

function toDecimalPlaces(value: Prisma.Decimal, scale: number) {
  return value.toDecimalPlaces(scale, Prisma.Decimal.ROUND_HALF_UP);
}

export function parseQuantityDecimal(value: string, options?: { scale?: number }) {
  const parsed = parseDecimalInput(value);

  if (!parsed) {
    return null;
  }

  return toDecimalPlaces(parsed, options?.scale ?? 3);
}

export function parseMoneyDecimal(value: string, options?: { scale?: number }) {
  const parsed = parseDecimalInput(value);

  if (!parsed) {
    return null;
  }

  return toDecimalPlaces(parsed, options?.scale ?? 2);
}

export function roundMoneyForCurrency(
  value: Prisma.Decimal,
  currency: string | null | undefined,
) {
  return toDecimalPlaces(value, getMoneyScaleForCurrency(currency));
}

export function decimalToFixedString(value: DecimalLike, scale: number) {
  if (value === null || value === undefined) {
    return scale === 0 ? "0" : `0.${"0".repeat(scale)}`;
  }

  const decimalValue =
    value instanceof Prisma.Decimal ? value : new Prisma.Decimal(String(value));

  return decimalValue.toFixed(scale);
}

export function formatDecimalDisplay(
  value: DecimalLike,
  options?: {
    scale?: number;
    trimTrailingZeros?: boolean;
  },
) {
  const scale = options?.scale ?? 0;
  const trimTrailingZeros = options?.trimTrailingZeros ?? false;
  const fixed = decimalToFixedString(value, scale);
  const sign = fixed.startsWith("-") ? "-" : "";
  const unsigned = sign ? fixed.slice(1) : fixed;
  const [integerPartRaw, decimalPartRaw = ""] = unsigned.split(".");
  const integerPart = integerPartRaw.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const decimalPart = trimTrailingZeros ? decimalPartRaw.replace(/0+$/, "") : decimalPartRaw;

  if (!decimalPart) {
    return `${sign}${integerPart}`;
  }

  return `${sign}${integerPart},${decimalPart}`;
}

export function formatCurrencyDisplay(value: DecimalLike) {
  return `$ ${formatDecimalDisplay(value, { scale: 0 })}`;
}

export function formatMoneyExport(
  value: DecimalLike,
  currency: string | null | undefined,
) {
  return decimalToFixedString(value, getMoneyScaleForCurrency(currency));
}
