/**
 * Datas como strings "YYYY-MM-DD" (datas locais, sem fuso), para evitar erros de fuso horário.
 */

export type ISODate = string;

function toUTC(d: ISODate): Date {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day));
}

function fromUTC(d: Date): ISODate {
  return d.toISOString().slice(0, 10);
}

export function addDays(d: ISODate, n: number): ISODate {
  const x = toUTC(d);
  x.setUTCDate(x.getUTCDate() + n);
  return fromUTC(x);
}

/** 0 = segunda … 6 = domingo. */
export function weekdayMon0(d: ISODate): number {
  return (toUTC(d).getUTCDay() + 6) % 7;
}

/** Segunda-feira da semana (Seg–Dom) a que a data pertence. */
export function weekStart(d: ISODate): ISODate {
  return addDays(d, -weekdayMon0(d));
}

export function daysBetween(a: ISODate, b: ISODate): number {
  return Math.round((toUTC(b).getTime() - toUTC(a).getTime()) / 86_400_000);
}

export function dateRange(start: ISODate, end: ISODate): ISODate[] {
  const out: ISODate[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Data de hoje num fuso horário (por omissão APP_TIMEZONE ou Europe/Lisbon). */
export function todayInTz(tz = process.env.APP_TIMEZONE || "Europe/Lisbon", now = new Date()): ISODate {
  return localDateInTz(now, tz);
}

export function localDateInTz(instant: Date, tz: string): ISODate {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(instant);
  const get = (t: string) => parts.find((p) => p.type === t)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function hourInTz(instant: Date, tz: string): number {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", hour12: false }).format(instant)) % 24;
}

const WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const WEEKDAYS_LONG = ["segunda", "terça", "quarta", "quinta", "sexta", "sábado", "domingo"];

export function weekdayShort(d: ISODate): string {
  return WEEKDAYS[weekdayMon0(d)];
}
export function weekdayLong(d: ISODate): string {
  return WEEKDAYS_LONG[weekdayMon0(d)];
}

/** "12/11" ou "12/11/2026". */
export function formatDatePt(d: ISODate, withYear = false): string {
  const [y, m, day] = d.split("-");
  return withYear ? `${day}/${m}/${y}` : `${day}/${m}`;
}

export function isISODate(s: unknown): s is ISODate {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}
