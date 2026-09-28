export { formatPeso } from "../../convex/lib/money";

// On screen, whole peso amounts drop the ".00" (₱3,150) and only show
// centavos when there are some (₱13,406.40). Receipts keep formatPeso.
export function formatMoney(centavos: number): string {
  const sign = centavos < 0 ? "-" : "";
  const abs = Math.abs(Math.round(centavos));
  const pesos = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const cents = abs % 100;
  return `${sign}₱${pesos}${cents ? `.${cents.toString().padStart(2, "0")}` : ""}`;
}

// Business dates are "YYYY-MM-DD" strings; formatting them as UTC keeps the
// calendar day from shifting on devices set to another time zone.
function dateOf(date: string) {
  return new Date(`${date}T00:00:00Z`);
}

export function formatDate(date: string, locale: string) {
  return dateOf(date).toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatShortDate(date: string, locale: string) {
  return dateOf(date).toLocaleDateString(locale, { month: "short", day: "numeric", timeZone: "UTC" });
}

export function formatDay(date: string, locale: string) {
  return dateOf(date).toLocaleDateString(locale, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatWeekday(date: string, locale: string) {
  return dateOf(date).toLocaleDateString(locale, { weekday: "short", timeZone: "UTC" });
}

export function formatTime(timestamp: number, locale: string) {
  return new Date(timestamp).toLocaleTimeString(locale, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Manila",
  });
}

export function formatDateTime(timestamp: number, locale: string) {
  return new Date(timestamp).toLocaleString(locale, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Manila",
  });
}

// Hour of day in Philippine time, for the greeting.
export function manilaHour(timestamp = Date.now()) {
  return new Date(timestamp + 8 * 60 * 60 * 1000).getUTCHours();
}

// "1,250.50" → 125050 centavos. Returns null for anything that isn't a
// non-negative amount with at most 2 decimals.
export function parsePeso(input: string): number | null {
  const cleaned = input.replace(/[₱,\s]/g, "");
  if (cleaned === "") return null;
  if (!/^\d+(\.\d{0,2})?$/.test(cleaned)) return null;
  return Math.round(parseFloat(cleaned) * 100);
}

export function pesoInput(centavos: number | undefined) {
  if (centavos === undefined) return "";
  return (centavos / 100).toFixed(2).replace(/\.00$/, "");
}

export function cx(...classes: (string | false | null | undefined | 0)[]) {
  return classes.filter(Boolean).join(" ");
}
