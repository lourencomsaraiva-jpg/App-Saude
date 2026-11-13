/**
 * Planeado vs realizado, automático a partir dos treinos do Garmin.
 * Um treino feito conta para o treino planeado do mesmo tipo: primeiro no mesmo dia; se esse já estiver
 * cumprido (ou não houver), até 2 dias antes/depois dentro da mesma semana (Seg–Dom).
 */
import { addDays, daysBetween, weekStart, type ISODate } from "../calc/dates";
import type { DB } from "../types";

const RUN_TYPES = ["fácil", "qualidade", "longo", "prova", "recuperação"];

export function matchPlanned(activityType: string, plannedType: string): boolean {
  if (activityType === "corrida") return RUN_TYPES.includes(plannedType);
  if (activityType === "força") return plannedType === "força";
  return false;
}

export interface LinkActivity {
  id: string;
  type: string;
  local_date: string;
  planned_workout_id: string | null;
}
export interface LinkPlanned {
  id: string;
  date: string;
  type: string;
}

/** Função pura: devolve pares atividade → treino planeado. */
export function computeLinks(acts: LinkActivity[], planned: LinkPlanned[]): Array<{ activityId: string; plannedId: string }> {
  const used = new Set(acts.map((a) => a.planned_workout_id).filter((x): x is string => !!x));
  const pending = acts.filter((a) => !a.planned_workout_id && (a.type === "corrida" || a.type === "força")).sort((a, b) => a.local_date.localeCompare(b.local_date));
  const out: Array<{ activityId: string; plannedId: string }> = [];
  // 1.º passo: mesmo dia; 2.º passo: ±1 dia; 3.º passo: ±2 dias (sempre na mesma semana)
  for (const maxGap of [0, 1, 2]) {
    for (const a of pending) {
      if (out.some((o) => o.activityId === a.id)) continue;
      const ws = weekStart(a.local_date);
      const cand = planned
        .filter((p) => !used.has(p.id) && matchPlanned(a.type, p.type) && weekStart(p.date) === ws && Math.abs(daysBetween(a.local_date, p.date)) <= maxGap)
        .sort((x, y) => Math.abs(daysBetween(a.local_date, x.date)) - Math.abs(daysBetween(a.local_date, y.date)) || x.date.localeCompare(y.date))[0];
      if (!cand) continue;
      used.add(cand.id);
      out.push({ activityId: a.id, plannedId: cand.id });
    }
  }
  return out;
}

export async function linkActivitiesToPlan(db: DB, userId: string, oldest: ISODate, newest: ISODate) {
  // janela alargada à semana inteira para poder ligar treinos feitos noutro dia da mesma semana
  const from = weekStart(oldest);
  const to = addDays(weekStart(newest), 6);
  const [{ data: acts }, { data: planned }] = await Promise.all([
    db.from("activities").select("id, type, local_date, planned_workout_id").eq("user_id", userId).gte("local_date", from).lte("local_date", to),
    db.from("planned_workouts").select("id, date, type, status").eq("user_id", userId).gte("date", from).lte("date", to),
  ]);
  const links = computeLinks((acts ?? []) as LinkActivity[], (planned ?? []) as LinkPlanned[]);
  for (const l of links) {
    await db.from("activities").update({ planned_workout_id: l.plannedId }).eq("id", l.activityId);
    await db.from("planned_workouts").update({ status: "feito" }).eq("id", l.plannedId).eq("status", "planeado");
  }
}
