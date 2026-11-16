/** Treinos planeados num intervalo com a nota de execução (0–100) de cada um. */
import { workoutExecution } from "../calc/execution";
import type { DB } from "../types";

type Row = {
  date: string; type: string; status: string; title: string; distance_km: string | number | null;
  target_pace_min_s: number | null; target_pace_max_s: number | null; target_hr_max: number | null;
  activities: Array<{ distance_m: string | number | null; avg_hr: number | null; activity_laps: Array<{ kind: string; distance_m: string | number | null; duration_s: string | number | null; avg_hr: number | null }> }> | null;
};
export interface PlannedExec {
  date: string;
  type: string;
  title: string;
  status: string;
  /** null = feito sem atividade do Garmin (confirmado à mão), sem avaliação */
  score: number | null;
  hasActivity: boolean;
}

export async function loadPlannedExecution(db: DB, start: string, end: string, easyHrMax = 150): Promise<PlannedExec[]> {
  const { data } = await db
    .from("planned_workouts")
    .select("date, type, status, title, distance_km, target_pace_min_s, target_pace_max_s, target_hr_max, activities(distance_m, avg_hr, activity_laps(kind, distance_m, duration_s, avg_hr))")
    .gte("date", start)
    .lte("date", end);
  const n = (x: unknown) => (x === null || x === undefined ? null : Number(x));
  return ((data ?? []) as unknown as Row[]).map((p) => {
    const a = [...(p.activities ?? [])].sort((x, y) => Number(y.distance_m ?? 0) - Number(x.distance_m ?? 0))[0] ?? null;
    const score = workoutExecution(
      { type: p.type, title: p.title, distance_km: n(p.distance_km), target_pace_min_s: p.target_pace_min_s, target_pace_max_s: p.target_pace_max_s, target_hr_max: p.target_hr_max },
      a ? { distance_m: n(a.distance_m), avg_hr: a.avg_hr } : null,
      (a?.activity_laps ?? []).filter((l) => l.kind === "km_split").map((l) => ({ distance_m: n(l.distance_m), duration_s: n(l.duration_s), avg_hr: l.avg_hr })),
      easyHrMax,
    );
    return { date: p.date, type: p.type, title: p.title, status: p.status, score: p.status === "feito" && !a ? null : score, hasActivity: !!a };
  });
}
