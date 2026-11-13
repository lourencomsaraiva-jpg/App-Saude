/** Envia um treino planeado da app para o Intervals.icu (→ Garmin). Partilhado pela app e pelo conector. */
import { isISODate } from "../calc/dates";
import type { DB, PlannedWorkoutRow } from "../types";
import { intervalsConfigFromEnv, upsertWorkoutEvent } from "./intervals";
import { toIntervalsWorkout } from "./intervals-workout";

const RUN_TYPES = ["fácil", "qualidade", "longo", "prova", "recuperação"];

export async function sendPlannedWorkout(db: DB, userId: string, workoutId: string, dateOverride?: string) {
  const cfg = intervalsConfigFromEnv();
  if (!cfg) throw new Error("Intervals.icu não configurado.");
  const { data } = await db.from("planned_workouts").select("*").eq("id", workoutId).eq("user_id", userId).maybeSingle();
  if (!data) throw new Error("Treino não encontrado.");
  const w = data as PlannedWorkoutRow;
  if (!RUN_TYPES.includes(w.type)) throw new Error("Só treinos de corrida podem ser enviados para o Garmin.");
  const date = dateOverride && isISODate(dateOverride) ? dateOverride : w.date;
  const { name, description } = toIntervalsWorkout(w.title, w.structure ?? []);
  const label = date !== w.date ? `${name} (teste)` : name;
  // external_id inclui a data: o envio de teste para outro dia não substitui o treino do dia certo
  const ev = await upsertWorkoutEvent(cfg, { date, name: label, description, externalId: `app-${w.id}-${date}`, distanceKm: w.distance_km });
  return { date, name: label, description, intervals_event_id: ev?.id ?? null };
}
