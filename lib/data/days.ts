import { dateRange, type ISODate } from "../calc/dates";
import { summarizeDay, type DaySummary } from "../calc/day";
import { cardiacCost, paceFromDistance } from "../calc/running";
import { round1 } from "../calc/numbers";
import type { ActivityRow, DB, DayRow, MealRow, SleepRow } from "../types";
import type { Settings } from "./settings";

export interface DayView {
  date: ISODate;
  summary: DaySummary;
  weight_kg: number | null;
  weight_source: string | null;
  steps: number | null;
  resting_hr: number | null;
  hrv: number | null;
  notes: string | null;
  sleep: SleepRow | null;
  activities: Array<ActivityRow & { pace: number | null; cardiac_cost: number | null }>;
  run_distance_km: number | null;
  run_pace: number | null;
  run_avg_hr: number | null;
  has_food: boolean;
}

const ACTIVITY_COLS =
  "id, external_id, source, name, type, start_time, local_date, distance_m, duration_s, moving_time_s, avg_hr, max_hr, kcal_raw, ascent_m, descent_m, training_effect, training_load, conditions, feel, fit_path, planned_workout_id, ai_analysis";

/**
 * Carrega dias num intervalo e calcula os resumos com lib/calc.
 * `onlyWithData`: devolve só dias com algum registo (comida, atividade, peso, sono, notas).
 */
export async function loadDays(db: DB, start: ISODate, end: ISODate, settingsIn: Settings | Promise<Settings>, onlyWithData = true, userId?: string): Promise<DayView[]> {
  // userId só é necessário com o cliente admin (cron); com o cliente do utilizador a RLS já filtra.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scope = (q: any) => (userId ? q.eq("user_id", userId) : q);
  // as definições podem vir como promessa: assim carregam em paralelo com estas leituras
  const [settings, meals, acts, days, sleeps] = await Promise.all([
    settingsIn,
    scope(db.from("meals").select("date, meal_items(kcal, protein_g, carbs_g, fat_g, fiber_g)").gte("date", start).lte("date", end)),
    scope(db.from("activities").select(ACTIVITY_COLS).gte("local_date", start).lte("local_date", end).order("start_time")),
    scope(db.from("days").select("*").gte("date", start).lte("date", end)),
    scope(db.from("sleep").select("*").gte("day_date", start).lte("day_date", end)),
  ]);
  for (const r of [meals, acts, days, sleeps] as unknown as Array<{ error: { message: string } | null }>) if (r.error) throw new Error(r.error.message);

  const itemsByDate = new Map<string, Array<{ kcal: number; protein_g: number | null; carbs_g: number | null; fat_g: number | null; fiber_g: number | null }>>();
  for (const m of (meals.data ?? []) as unknown as Array<Pick<MealRow, "date"> & { meal_items: NonNullable<MealRow["meal_items"]> }>) {
    const list = itemsByDate.get(m.date) ?? [];
    for (const i of m.meal_items ?? []) list.push({ kcal: Number(i.kcal), protein_g: n(i.protein_g), carbs_g: n(i.carbs_g), fat_g: n(i.fat_g), fiber_g: n(i.fiber_g) });
    itemsByDate.set(m.date, list);
  }
  const actsByDate = new Map<string, ActivityRow[]>();
  for (const a of (acts.data ?? []) as ActivityRow[]) actsByDate.set(a.local_date, [...(actsByDate.get(a.local_date) ?? []), a]);
  const dayByDate = new Map(((days.data ?? []) as DayRow[]).map((d) => [d.date, d]));
  const sleepByDate = new Map(((sleeps.data ?? []) as SleepRow[]).map((s) => [s.day_date, s]));

  const out: DayView[] = [];
  for (const date of dateRange(start, end).reverse()) {
    const items = itemsByDate.get(date) ?? [];
    const activities = actsByDate.get(date) ?? [];
    const day = dayByDate.get(date);
    const sleep = sleepByDate.get(date) ?? null;
    const hasData = items.length > 0 || activities.length > 0 || !!day || !!sleep;
    if (onlyWithData && !hasData) continue;
    const summary = summarizeDay(
      { date, items, activityKcalRaw: activities.map((a) => n(a.kcal_raw)), exerciseKcalRawOverride: n(day?.exercise_kcal_raw_override) },
      settings.energy,
      settings.phases,
    );
    const runs = activities.filter((a) => a.type === "corrida" && a.distance_m);
    const runDist = runs.reduce((s, a) => s + Number(a.distance_m ?? 0), 0);
    const runTime = runs.reduce((s, a) => s + Number(a.moving_time_s ?? a.duration_s ?? 0), 0);
    const hrWeighted = runs.filter((a) => a.avg_hr);
    const hrTime = hrWeighted.reduce((s, a) => s + Number(a.moving_time_s ?? a.duration_s ?? 0), 0);
    out.push({
      date,
      summary,
      weight_kg: n(day?.weight_kg),
      weight_source: day?.weight_source ?? null,
      steps: n(day?.steps),
      resting_hr: n(day?.resting_hr),
      hrv: n(day?.hrv),
      notes: day?.notes ?? null,
      sleep,
      activities: activities.map((a) => {
        const pace = paceFromDistance(n(a.distance_m), n(a.moving_time_s) ?? n(a.duration_s));
        return { ...a, pace, cardiac_cost: a.type === "corrida" ? cardiacCost(a.avg_hr, pace) : null };
      }),
      run_distance_km: runDist > 0 ? round1(runDist / 1000) : null,
      run_pace: runDist > 0 && runTime > 0 ? paceFromDistance(runDist, runTime) : null,
      run_avg_hr: hrTime > 0 ? Math.round(hrWeighted.reduce((s, a) => s + Number(a.avg_hr) * Number(a.moving_time_s ?? a.duration_s ?? 0), 0) / hrTime) : null,
      has_food: items.length > 0,
    });
  }
  return out;
}

function n(v: unknown): number | null {
  return v === null || v === undefined || v === "" ? null : Number(v);
}
