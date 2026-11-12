/**
 * Sono: guardar total, profundo, leve, REM e acordado em minutos.
 * Validação: profundo + leve + REM = total (o tempo acordado não conta para o total).
 * Convenção: a noite que acaba na manhã do dia X fica associada ao dia X−1.
 */
import { addDays, type ISODate } from "./dates";

export interface SleepMinutes {
  total_min: number | null;
  deep_min: number | null;
  light_min: number | null;
  rem_min: number | null;
  awake_min: number | null;
}

/** "7:35" → 455; "27min" → 27; "1h05" → 65; "45" → 45 (minutos). */
export function parseDuration(token: string): number | null {
  const t = token.trim().toLowerCase().replace(/[?~]/g, "");
  let m = t.match(/^(\d{1,2}):(\d{2})/);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  m = t.match(/^(\d{1,2})\s*h\s*(\d{1,2})?/);
  if (m) return Number(m[1]) * 60 + (m[2] ? Number(m[2]) : 0);
  m = t.match(/^(\d+)\s*(min|m)?\b/);
  if (m) return Number(m[1]);
  return null;
}

/**
 * Interpreta o texto do histórico, ex.:
 * "7:35 (profundo 1:37, leve 4:49, REM 1:09, acordado 27min)".
 */
export function parseSleepText(text: string | null | undefined): SleepMinutes | null {
  if (!text || !text.trim()) return null;
  const out: SleepMinutes = { total_min: null, deep_min: null, light_min: null, rem_min: null, awake_min: null };
  const head = text.split("(")[0];
  out.total_min = parseDuration(head);
  const find = (label: RegExp) => {
    const m = text.match(label);
    return m ? parseDuration(m[1]) : null;
  };
  out.deep_min = find(/profundo\s+([\d:h]+\s*(?:min)?)/i);
  out.light_min = find(/leve\s+([\d:h]+\s*(?:min)?)/i);
  out.rem_min = find(/rem\s+([\d:h]+\s*(?:min)?)/i);
  out.awake_min = find(/acordado\s+([\d:h]+\s*(?:min)?)/i);
  if (out.total_min === null && out.deep_min === null) return null;
  return out;
}

export interface SleepValidation {
  ok: boolean;
  /** (profundo + leve + REM) − total, em minutos. */
  diffMin: number | null;
  message?: string;
}

export function validateSleep(s: SleepMinutes, toleranceMin = 1): SleepValidation {
  if (s.total_min === null) return { ok: false, diffMin: null, message: "Falta o total." };
  if (s.deep_min === null || s.light_min === null || s.rem_min === null) return { ok: true, diffMin: null };
  const diff = s.deep_min + s.light_min + s.rem_min - s.total_min;
  if (Math.abs(diff) <= toleranceMin) return { ok: true, diffMin: diff };
  return { ok: false, diffMin: diff, message: `Profundo + leve + REM difere do total em ${diff} min.` };
}

/** Dia a que fica associada a noite que acaba na manhã de `wakeDate`. */
export function sleepDayForWakeDate(wakeDate: ISODate): ISODate {
  return addDays(wakeDate, -1);
}

/** 455 → "7:35". */
export function formatMinutes(min: number | null | undefined): string {
  if (min === null || min === undefined || !Number.isFinite(min)) return "—";
  const m = Math.round(min);
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
}
