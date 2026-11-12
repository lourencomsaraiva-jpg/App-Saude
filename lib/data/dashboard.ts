/**
 * Dados do dashboard de Evolução (função pura a partir dos DayView já calculados por lib/calc).
 */
import { addDays, weekStart, type ISODate } from "../calc/dates";
import { mean, round1, sum } from "../calc/numbers";
import { hrAtReferencePace } from "../calc/running";
import { rollingAverage, weeklyWeightAverages } from "../calc/weight";
import type { DayView } from "./days";

export type RunKind = "fácil" | "qualidade" | "longo";

/** Classificação de uma corrida: tipo do plano se estiver ligado; senão heurística por distância/ritmo/FC. */
export function classifyRun(distanceKm: number, pace: number | null, avgHr: number | null, plannedType: string | null, thresholdHrMin = 162): RunKind {
  if (plannedType === "longo" || plannedType === "qualidade" || plannedType === "fácil") return plannedType;
  if (plannedType === "prova") return "qualidade";
  if (distanceKm >= 14) return "longo";
  if ((pace !== null && pace < 5.0) || (avgHr !== null && avgHr >= thresholdHrMin - 4)) return "qualidade";
  return "fácil";
}

export function buildDashboard(daysDesc: DayView[], opts: { plannedTypeByActivity: Map<string, string>; thresholdHrMin?: number }) {
  const days = [...daysDesc].sort((a, b) => a.date.localeCompare(b.date));
  const withFood = days.filter((d) => d.has_food);
  const runs = days.flatMap((d) => d.activities.filter((a) => a.type === "corrida" && a.distance_m && a.pace).map((a) => ({ ...a, date: d.date })));
  const allActs = days.flatMap((d) => d.activities.map((a) => ({ ...a, date: d.date })));
  const weights = days.filter((d) => d.weight_kg !== null);

  const kpis = {
    weight_current: weights.length ? weights[weights.length - 1].weight_kg : null,
    weight_current_date: weights.length ? weights[weights.length - 1].date : null,
    weight_avg: mean(weights.map((d) => d.weight_kg)),
    kcal_avg: mean(withFood.map((d) => d.summary.eaten.kcal)),
    target_avg: mean(withFood.map((d) => d.summary.target.kcal)),
    balance_avg: mean(withFood.map((d) => d.summary.balance_kcal)),
    workouts: allActs.length,
    run_km: round1(sum(runs.map((r) => Number(r.distance_m) / 1000))),
    steps_avg: mean(days.map((d) => d.steps)),
    sleep_avg_min: mean(days.map((d) => d.sleep?.total_min ?? null)),
    burn_avg: mean(days.map((d) => d.summary.base_burn_kcal + d.summary.exercise_kcal_adj)),
    fiber_avg: mean(withFood.map((d) => d.summary.eaten.fiber_g)),
    protein_avg: mean(withFood.map((d) => d.summary.eaten.protein_g)),
    carbs_avg: mean(withFood.map((d) => d.summary.eaten.carbs_g)),
    fat_avg: mean(withFood.map((d) => d.summary.eaten.fat_g)),
    exercise_kcal_raw_total: sum(days.map((d) => d.summary.exercise_kcal_raw)),
    exercise_kcal_adj_total: sum(days.map((d) => d.summary.exercise_kcal_adj)),
    protein_days_on_target: withFood.filter((d) => d.summary.protein_on_target).length,
    food_days: withFood.length,
  };

  // médias semanais de peso (para a linha e para o resumo)
  const weeklyWeight = weeklyWeightAverages(days.map((d) => ({ date: d.date, weight_kg: d.weight_kg })));
  const wwByWeek = new Map(weeklyWeight.map((w) => [w.week_start, w]));

  const sleep7 = rollingAverage(days.map((d) => ({ date: d.date, value: d.sleep?.total_min ?? null })), 7);
  const sleep7ByDate = new Map(sleep7.map((s) => [s.date, s.avg]));

  const daily = days.map((d) => ({
    date: d.date,
    weight: d.weight_kg,
    weight_week_avg: wwByWeek.get(weekStart(d.date))?.avg_kg ?? null,
    kcal: d.has_food ? d.summary.eaten.kcal : null,
    target: d.summary.target.kcal,
    balance: d.has_food ? d.summary.balance_kcal : null,
    protein: d.summary.eaten.protein_g,
    protein_target: d.summary.target.protein_g,
    carbs: d.summary.eaten.carbs_g,
    carbs_target: d.summary.target.carbs_g,
    fat: d.summary.eaten.fat_g,
    fat_target: d.summary.target.fat_g,
    fiber: d.summary.eaten.fiber_g,
    fiber_target: d.summary.target.fiber_g,
    steps: d.steps,
    sleep_h: d.sleep?.total_min ? round1(d.sleep.total_min / 60) : null,
    sleep_7d_h: sleep7ByDate.get(d.date) ? round1((sleep7ByDate.get(d.date) as number) / 60) : null,
  }));

  // treinos por tipo, por semana
  const types = ["corrida", "força", "bicicleta", "outro"] as const;
  const weeksMap = new Map<ISODate, Record<string, number>>();
  for (const a of allActs) {
    const ws = weekStart(a.date);
    const t = (types as readonly string[]).includes(a.type) ? a.type : "outro";
    const row = weeksMap.get(ws) ?? { corrida: 0, força: 0, bicicleta: 0, outro: 0 };
    row[t] += 1;
    weeksMap.set(ws, row);
  }
  const workoutsByWeek = [...weeksMap.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([week, v]) => ({ week, ...v }));

  const runPoints = runs.map((r) => {
    const km = Number(r.distance_m) / 1000;
    return { id: r.id, date: r.date, km: round1(km), pace: r.pace as number, hr: r.avg_hr, cc: r.cardiac_cost, kind: classifyRun(km, r.pace, r.avg_hr, opts.plannedTypeByActivity.get(r.id) ?? null, opts.thresholdHrMin) };
  });
  const efficiency = hrAtReferencePace(runPoints.map((r) => ({ ...r, avg_hr: r.hr })), 5.5, 0.25).map((r) => ({ date: r.date, hr: r.hr, pace: r.pace }));

  // resumo semanal
  const weekStarts = [...new Set(days.map((d) => weekStart(d.date)))].sort().reverse();
  const weekly = weekStarts.map((ws) => {
    const wd = days.filter((d) => d.date >= ws && d.date <= addDays(ws, 6));
    const food = wd.filter((d) => d.has_food);
    const ww = wwByWeek.get(ws);
    return {
      week_start: ws,
      days_logged: food.length,
      weight_avg: ww?.avg_kg ?? null,
      weight_delta: ww?.delta_kg ?? null,
      kcal_avg: mean(food.map((d) => d.summary.eaten.kcal)),
      balance_avg: mean(food.map((d) => d.summary.balance_kcal)),
      protein_days: food.filter((d) => d.summary.protein_on_target).length,
      workouts: wd.reduce((s, d) => s + d.activities.length, 0),
      run_km: round1(sum(wd.map((d) => d.run_distance_km))),
      sleep_avg_min: mean(wd.map((d) => d.sleep?.total_min ?? null)),
    };
  });

  return { kpis, daily, workoutsByWeek, runPoints, efficiency, weekly };
}
export type Dashboard = ReturnType<typeof buildDashboard>;
