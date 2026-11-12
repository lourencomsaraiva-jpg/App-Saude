/** Peso: média semanal Seg–Dom e Δ face à semana anterior. Sem previsões diárias. */
import { addDays, weekStart, type ISODate } from "./dates";
import { round1 } from "./numbers";

export interface WeeklyWeight {
  week_start: ISODate;
  avg_kg: number;
  count: number;
  delta_kg: number | null; // face à semana anterior (se tiver registos)
}

export function weeklyWeightAverages(entries: Array<{ date: ISODate; weight_kg: number | null }>): WeeklyWeight[] {
  const byWeek = new Map<ISODate, number[]>();
  for (const e of entries) {
    if (e.weight_kg === null || !Number.isFinite(e.weight_kg)) continue;
    const ws = weekStart(e.date);
    byWeek.set(ws, [...(byWeek.get(ws) ?? []), e.weight_kg]);
  }
  const weeks = [...byWeek.keys()].sort();
  const avgs = new Map<ISODate, number>();
  for (const w of weeks) {
    const vals = byWeek.get(w)!;
    avgs.set(w, round1(vals.reduce((a, b) => a + b, 0) / vals.length));
  }
  return weeks.map((w) => {
    const prev = avgs.get(addDays(w, -7));
    const avg = avgs.get(w)!;
    return { week_start: w, avg_kg: avg, count: byWeek.get(w)!.length, delta_kg: prev === undefined ? null : round1(avg - prev) };
  });
}

/** Média móvel simples de N dias (ignorando nulos), alinhada com cada data. */
export function rollingAverage(series: Array<{ date: ISODate; value: number | null }>, days = 7): Array<{ date: ISODate; avg: number | null }> {
  const map = new Map(series.map((s) => [s.date, s.value]));
  return series.map((s) => {
    const vals: number[] = [];
    for (let i = 0; i < days; i++) {
      const v = map.get(addDays(s.date, -i));
      if (typeof v === "number") vals.push(v);
    }
    return { date: s.date, avg: vals.length ? round1(vals.reduce((a, b) => a + b, 0) / vals.length) : null };
  });
}
