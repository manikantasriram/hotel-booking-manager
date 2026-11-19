const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });

export const money = (value: number) => inr.format(value);

/** "2026-11-15" -> "15 Nov 2026". Parsed as a local date, so it never shifts a day. */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return dateFmt.format(new Date(y, m - 1, d));
}

const toIso = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** Today (or today + n days) as "YYYY-MM-DD" in the user's own time zone. */
export function isoDate(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return toIso(d);
}

/** "2026-11-15" + 1 -> "2026-11-16", worked out in local time so no time zone can shift it. */
export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return toIso(new Date(y, m - 1, d + days));
}

export function nightsBetween(checkIn: string, checkOut: string): number {
  const ms = Date.parse(`${checkOut}T00:00:00Z`) - Date.parse(`${checkIn}T00:00:00Z`);
  return Number.isFinite(ms) ? Math.round(ms / 86_400_000) : 0;
}

export const percent = (value: number) => `${Math.round(value * 100)}%`;
