// Shared display formatting. Money/date formatting used to be copy-pasted as
// `"৳" + n.toLocaleString(...)` in 13 places, which drifted between pages.

const BDT = "৳";

export interface MoneyOptions {
  /** Decimal places; defaults to 2 (paisa), matching the wallet ledger. */
  decimals?: number;
  /** Omit the ৳ symbol (e.g. chart axes). */
  symbol?: boolean;
}

export function fmtMoney(
  value: number | null | undefined,
  { decimals = 2, symbol = true }: MoneyOptions = {}
): string {
  const n = typeof value === "number" && Number.isFinite(value) ? value : 0;
  const body = n.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return symbol ? `${BDT}${body}` : body;
}

/** Compact money for cards where paisa is noise (e.g. ৳150). */
export function fmtMoneyShort(value: number | null | undefined): string {
  const n = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return `${BDT}${n.toLocaleString()}`;
}

export function fmtDateTime(
  value: string | Date | null | undefined,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" }
): string {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString([], options);
}

export function fmtDate(value: string | Date | null | undefined): string {
  return fmtDateTime(value, { dateStyle: "medium" });
}

/** Display an 11-digit BD mobile as `01711 233 445` (storage stays untouched). */
export function fmtPhone(value: string | null | undefined): string {
  const digits = (value ?? "").replace(/\D/g, "");
  if (digits.length !== 11) return value ?? "";
  return `${digits.slice(0, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
}
