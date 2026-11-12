/**
 * Verificação pós-importação: os totais e saldos calculados pela app têm de coincidir com o ficheiro.
 */
import { adjustedExercise, caloricBalance } from "../calc/energy";
import { parseDecimal } from "../calc/numbers";
import { parseSleepText } from "../calc/sleep";
import type { DayView } from "../data/days";
import type { EnergySettings } from "../calc/energy";
import type { SeedEntry } from "./seed";

export interface Mismatch {
  date: string;
  field: string;
  file: number | null;
  app: number | null;
}

const dec = (v: string | undefined) => (v === undefined || v.trim() === "" ? null : parseDecimal(v));
const r1 = (v: number | null) => (v === null ? null : Math.round(v * 10) / 10);

/** Valores esperados diretamente a partir do ficheiro (sem passar pela base de dados). */
export function expectedFromFile(e: SeedEntry, s: EnergySettings) {
  const eaten = r1(dec(e.caloriasConsumidas)) ?? 0;
  const raw = dec(e.gastoExercicio) ?? 0;
  const base = dec(e.gastoNormal) ?? s.baseBurnKcal;
  const adj = adjustedExercise(raw, e.data, s);
  return {
    kcal: eaten,
    protein_g: r1(dec(e.proteina)),
    carbs_g: r1(dec(e.hidratos)),
    fat_g: r1(dec(e.gordura)),
    fiber_g: r1(dec(e.fibra)),
    exercise_kcal_raw: raw,
    balance_kcal: caloricBalance(eaten, base, adj),
    weight_kg: r1(dec(e.peso)),
    sleep_total_min: parseSleepText(e.sono)?.total_min ?? null,
  };
}

export function compareWithFile(entries: SeedEntry[], days: DayView[], s: EnergySettings): Mismatch[] {
  const byDate = new Map(days.map((d) => [d.date, d]));
  const out: Mismatch[] = [];
  for (const e of entries) {
    const exp = expectedFromFile(e, s);
    const d = byDate.get(e.data);
    const app = {
      kcal: d?.summary.eaten.kcal ?? null,
      protein_g: d?.summary.eaten.protein_g ?? null,
      carbs_g: d?.summary.eaten.carbs_g ?? null,
      fat_g: d?.summary.eaten.fat_g ?? null,
      fiber_g: d?.summary.eaten.fiber_g ?? null,
      exercise_kcal_raw: d?.summary.exercise_kcal_raw ?? null,
      balance_kcal: d?.summary.balance_kcal ?? null,
      weight_kg: d?.weight_kg ?? null,
      sleep_total_min: d?.sleep?.total_min ?? null,
    };
    for (const k of Object.keys(exp) as Array<keyof typeof exp>) {
      const a = app[k];
      const f = exp[k];
      if (!(a === f || (a !== null && f !== null && Math.abs(a - f) < 0.05))) out.push({ date: e.data, field: k, file: f, app: a });
    }
  }
  return out;
}
