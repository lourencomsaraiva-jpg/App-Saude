/**
 * Peso vindo do iPhone (app Saúde) por um Atalho: interpreta o valor e a data tal como o Atalho os envia
 * ("81,2 kg", 81.2, "179 lb"; "2026-11-14T07:12:00+00:00", "14/11/2026, 07:12", "14 de novembro de 2026 às 07:12",
 * "Nov 14, 2026 at 7:12 AM").
 */
import { localDateInTz, type ISODate } from "../calc/dates";
import { round1 } from "../calc/numbers";

export function parseWeight(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  const m = v.replace(/\s/g, "").replace(",", ".").match(/(\d+(?:\.\d+)?)(kg|lb|lbs)?/i);
  if (!m) return null;
  const n = Number(m[1]);
  return /lb/i.test(m[2] ?? "") ? n * 0.45359237 : n;
}

const PT_MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const EN_MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const PT_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

export function parseHealthDate(v: unknown, tz: string): ISODate | null {
  if (typeof v !== "string" || !v.trim()) return null;
  const s = v.trim().toLowerCase();
  // ISO com hora: converte para o dia local
  if (/^\d{4}-\d{2}-\d{2}t/.test(s)) {
    const t = Date.parse(v);
    return Number.isNaN(t) ? s.slice(0, 10) : localDateInTz(new Date(t), tz);
  }
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return iso(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
  if (m) return iso(+m[3], +m[2], +m[1]);
  m = s.match(/^(\d{1,2})\s+(?:de\s+)?([a-zç]+)\.?\s+(?:de\s+)?(\d{4})/);
  if (m) {
    const name = m[2];
    let i = PT_MONTHS.indexOf(name);
    if (i < 0) i = PT_SHORT.indexOf(name.slice(0, 3));
    if (i < 0) i = EN_MONTHS.indexOf(name.slice(0, 3));
    if (i >= 0) return iso(+m[3], i + 1, +m[1]);
  }
  m = s.match(/^([a-z]+)\.?\s+(\d{1,2}),?\s+(\d{4})/);
  if (m) {
    const i = EN_MONTHS.indexOf(m[1].slice(0, 3));
    if (i >= 0) return iso(+m[3], i + 1, +m[2]);
  }
  return null;
}

export function validWeight(kg: number | null): kg is number {
  return kg !== null && kg >= 30 && kg <= 250;
}
export { round1 };
