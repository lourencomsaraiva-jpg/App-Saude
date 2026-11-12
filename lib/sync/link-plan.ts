/** Liga automaticamente treinos importados ao treino planeado do mesmo dia (planeado vs realizado). */
import type { ISODate } from "../calc/dates";
import type { DB } from "../types";

const RUN_TYPES = ["fácil", "qualidade", "longo", "prova", "recuperação"];

export function matchPlanned(activityType: string, plannedType: string): boolean {
  if (activityType === "corrida") return RUN_TYPES.includes(plannedType);
  if (activityType === "força") return plannedType === "força";
  return false;
}

export async function linkActivitiesToPlan(db: DB, userId: string, oldest: ISODate, newest: ISODate) {
  const [{ data: acts }, { data: planned }] = await Promise.all([
    db.from("activities").select("id, type, local_date, planned_workout_id").eq("user_id", userId).gte("local_date", oldest).lte("local_date", newest),
    db.from("planned_workouts").select("id, date, type, status").eq("user_id", userId).gte("date", oldest).lte("date", newest),
  ]);
  const used = new Set((acts ?? []).map((a: { planned_workout_id: string | null }) => a.planned_workout_id).filter(Boolean));
  for (const a of (acts ?? []) as Array<{ id: string; type: string; local_date: string; planned_workout_id: string | null }>) {
    if (a.planned_workout_id) continue;
    const p = ((planned ?? []) as Array<{ id: string; date: string; type: string; status: string }>).find((w) => w.date === a.local_date && !used.has(w.id) && matchPlanned(a.type, w.type));
    if (!p) continue;
    used.add(p.id);
    await db.from("activities").update({ planned_workout_id: p.id }).eq("id", a.id);
    if (p.status === "planeado") await db.from("planned_workouts").update({ status: "feito" }).eq("id", p.id);
  }
}
