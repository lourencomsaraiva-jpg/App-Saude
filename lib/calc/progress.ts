/**
 * Índice de evolução (0–100) por semana, a juntar tudo o que a app mede.
 * Cada componente vale 0–100 (ou null se não houver dados nessa semana); o índice é a média dos que existem.
 *
 *  Peso        ritmo de perda vs. objetivo: −0,25 a −1,0 kg/semana = 100; estável = 50; +0,5 kg = 0
 *  Nutrição    por dia: 50% kcal dentro de ±10% do alvo (0 a ±30%), 30% proteína, 20% fibra
 *  Sono        média por noite: 5 h = 0, 7,5 h = 100 (média com a pontuação do Garmin, se existir)
 *  Treino      treinos planeados feitos / planeados (até hoje)
 *  Eficiência  custo cardíaco médio das corridas vs. a tua mediana do período (−2% = 60, −10% = 100)
 *  Recuperação FC de repouso e VFC vs. a tua mediana (−1 bpm = 60; VFC +4% = 60)
 *  Passos      média diária / 10 000
 */
import { addDays, weekStart, type ISODate } from "./dates";
import { round1 } from "./numbers";

export interface ProgressDay {
  date: ISODate;
  weight_kg: number | null;
  steps: number | null;
  resting_hr: number | null;
  hrv: number | null;
  sleep_min: number | null;
  sleep_score: number | null;
  has_food: boolean;
  kcal: number;
  kcal_target: number;
  protein_g: number | null;
  protein_target: number;
  fiber_g: number | null;
  fiber_target: number;
  run_cardiac_costs: number[];
}
export interface ProgressPlanned {
  date: ISODate;
  type: string;
  status: string;
}

export const COMPONENTS = [
  ["peso", "Peso"],
  ["nutricao", "Nutrição"],
  ["sono", "Sono"],
  ["treino", "Treino"],
  ["eficiencia", "Eficiência"],
  ["recuperacao", "Recuperação"],
  ["passos", "Passos"],
] as const;
export type ComponentKey = (typeof COMPONENTS)[number][0];

export interface ProgressWeek {
  week_start: ISODate;
  index: number | null;
  parts: Record<ComponentKey, number | null>;
  /** valores de base usados (para o tooltip) */
  raw: { weight_avg: number | null; weight_delta: number | null; sleep_avg_min: number | null; plan_done: number; plan_total: number; cardiac_cost: number | null; rhr: number | null; hrv: number | null; steps: number | null; food_days: number };
}

const clamp = (x: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, x));
const nums = (xs: Array<number | null | undefined>) => xs.filter((x): x is number => typeof x === "number" && Number.isFinite(x));
const avg = (xs: Array<number | null | undefined>) => {
  const v = nums(xs);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};
const median = (xs: Array<number | null | undefined>) => {
  const v = nums(xs).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
};

export function weightScore(delta: number, atOrBelowGoal: boolean): number {
  if (atOrBelowGoal) return clamp(100 - Math.abs(delta) * 100); // manutenção: estável é o ideal
  if (delta <= -0.25 && delta >= -1) return 100;
  if (delta < -1) return clamp(100 - (-1 - delta) * 60); // demasiado rápido
  if (delta < 0) return 50 + (-delta / 0.25) * 50; // 0 → 50; −0,25 → 100
  return clamp(50 - (delta / 0.5) * 50); // +0,5 kg → 0
}

export function nutritionDayScore(d: Pick<ProgressDay, "kcal" | "kcal_target" | "protein_g" | "protein_target" | "fiber_g" | "fiber_target">): number | null {
  if (!d.kcal_target || d.kcal <= 0) return null;
  const dev = Math.abs(d.kcal - d.kcal_target) / d.kcal_target;
  const k = dev <= 0.1 ? 1 : Math.max(0, 1 - (dev - 0.1) / 0.2);
  const parts: Array<[number, number]> = [[k, 0.5]];
  if (d.protein_g !== null && d.protein_target > 0) parts.push([Math.min(1, d.protein_g / d.protein_target), 0.3]);
  if (d.fiber_g !== null && d.fiber_g > 0 && d.fiber_target > 0) parts.push([Math.min(1, d.fiber_g / d.fiber_target), 0.2]);
  const w = parts.reduce((a, [, x]) => a + x, 0);
  return (parts.reduce((a, [v, x]) => a + v * x, 0) / w) * 100;
}

export function progressIndex(days: ProgressDay[], planned: ProgressPlanned[], opts: { today: ISODate; goalWeightKg: number | null }): ProgressWeek[] {
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
  const ccBase = median(sorted.flatMap((d) => d.run_cardiac_costs));
  const rhrBase = median(sorted.map((d) => d.resting_hr));
  const hrvBase = median(sorted.map((d) => d.hrv));

  const weeks = [...new Set(sorted.map((d) => weekStart(d.date)))].sort();
  const out: ProgressWeek[] = [];
  let prevWeightAvg: number | null = null;
  for (const ws of weeks) {
    const we = addDays(ws, 6);
    const wd = sorted.filter((d) => d.date >= ws && d.date <= we);

    // peso: precisa de ≥2 pesagens e de uma semana anterior com média
    const weights = nums(wd.map((d) => d.weight_kg));
    const wAvg = weights.length >= 2 ? avg(weights) : null;
    const wDelta = wAvg !== null && prevWeightAvg !== null ? wAvg - prevWeightAvg : null;
    const peso = wDelta === null ? null : weightScore(wDelta, opts.goalWeightKg !== null && wAvg! <= opts.goalWeightKg);
    if (wAvg !== null) prevWeightAvg = wAvg;

    const foodDays = wd.filter((d) => d.has_food);
    const nutricao = avg(foodDays.map(nutritionDayScore));

    const sleepAvg = avg(wd.map((d) => d.sleep_min));
    const sleepScoreAvg = avg(wd.map((d) => d.sleep_score));
    const sono = sleepAvg === null ? null : avg([clamp(((sleepAvg - 300) / 150) * 100), sleepScoreAvg]);

    const wp = planned.filter((p) => p.date >= ws && p.date <= we && p.date < opts.today && p.type !== "descanso");
    const done = wp.filter((p) => p.status === "feito").length;
    const treino = wp.length ? (done / wp.length) * 100 : null;

    const cc = avg(wd.flatMap((d) => d.run_cardiac_costs));
    const eficiencia = cc !== null && ccBase ? clamp(50 + ((ccBase - cc) / ccBase) * 500) : null;

    const rhr = avg(wd.map((d) => d.resting_hr));
    const hrv = avg(wd.map((d) => d.hrv));
    const recuperacao = avg([rhr !== null && rhrBase !== null ? clamp(50 + (rhrBase - rhr) * 10) : null, hrv !== null && hrvBase ? clamp(50 + ((hrv - hrvBase) / hrvBase) * 250) : null]);

    const steps = avg(wd.map((d) => d.steps));
    const passos = steps === null ? null : clamp((steps / 10000) * 100);

    const parts = { peso, nutricao, sono, treino, eficiencia, recuperacao, passos };
    const r = (x: number | null) => (x === null ? null : Math.round(x));
    const rounded = Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, r(v)])) as Record<ComponentKey, number | null>;
    const idx = avg(Object.values(rounded));
    out.push({
      week_start: ws,
      index: r(idx),
      parts: rounded,
      raw: {
        weight_avg: wAvg === null ? null : round1(wAvg),
        weight_delta: wDelta === null ? null : round1(wDelta),
        sleep_avg_min: sleepAvg === null ? null : Math.round(sleepAvg),
        plan_done: done,
        plan_total: wp.length,
        cardiac_cost: cc === null ? null : round1(cc),
        rhr: rhr === null ? null : round1(rhr),
        hrv: hrv === null ? null : round1(hrv),
        steps: steps === null ? null : Math.round(steps),
        food_days: foodDays.length,
      },
    });
  }
  return out;
}
