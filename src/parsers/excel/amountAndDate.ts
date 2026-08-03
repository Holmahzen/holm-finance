export function parseAmountCell(value: unknown): number {
  if (typeof value === "number") return value;
  if (value == null) return 0;

  const text = String(value)
    .replace(/[^\d,.-]/g, "")
    .trim();
  if (!text) return 0;

  // Brazilian format "1.234,56" -> strip thousands dots, comma becomes decimal point.
  const hasComma = text.includes(",");
  const normalized = hasComma
    ? text.replace(/\./g, "").replace(",", ".")
    : text;

  const parsed = Number.parseFloat(normalized);
  return Number.isNaN(parsed) ? 0 : parsed;
}

const BR_DATE_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/;

export function parseDateCell(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (typeof value === "number") {
    // Excel serial date (days since 1899-12-30)
    const epoch = Date.UTC(1899, 11, 30);
    return new Date(epoch + value * 24 * 60 * 60 * 1000);
  }
  if (typeof value === "string") {
    const match = value.trim().match(BR_DATE_RE);
    if (match) {
      const [, day, month, yearRaw] = match;
      const year = yearRaw.length === 2 ? Number(yearRaw) + 2000 : Number(yearRaw);
      return new Date(Date.UTC(year, Number(month) - 1, Number(day)));
    }
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
}
