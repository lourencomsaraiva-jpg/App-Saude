/**
 * Ferramentas do treinador IA. Todas as contas são feitas aqui com lib/calc — a IA só lê os resultados.
 * Cada ferramenta devolve apenas o necessário (intervalos limitados a 62 dias).
 */
import type Anthropic from "@anthropic-ai/sdk";
import { addDays, daysBetween, isISODate, todayInTz, type ISODate } from "../calc/dates";
import { cardiacCost, formatDuration, formatPace, paceFromDistance, riegelProjection } from "../calc/running";
import { formatMinutes } from "../calc/sleep";
import { weeklyWeightAverages } from "../calc/weight";
import { loadDays } from "../data/days";
import { loadSettings, type Settings } from "../data/settings";
import type { DB } from "../types";

export interface ToolContext {
  db: DB;
  userId: string;
  settingsCache?: Settings;
}

const MAX_RANGE = 62;

function range(input: Record<string, unknown>, defDays = 7): { start: ISODate; end: ISODate } {
  const end = isISODate(input.end) ? input.end : todayInTz();
  let start = isISODate(input.start) ? input.start : addDays(end, -(defDays - 1));
  if (daysBetween(start, end) > MAX_RANGE) start = addDays(end, -MAX_RANGE);
  return { start, end };
}

async function settings(ctx: ToolContext) {
  ctx.settingsCache ??= await loadSettings(ctx.db, ctx.userId);
  return ctx.settingsCache;
}

const dateProps = {
  start: { type: "string", description: "Data inicial YYYY-MM-DD" },
  end: { type: "string", description: "Data final YYYY-MM-DD (inclusive)" },
};

export const COACH_TOOLS: Anthropic.Tool[] = [
  {
    name: "get_profile_and_targets",
    description: "Perfil, objetivos, provas, zonas de ritmo/FC, alvos fixos (proteína, fibra), gasto base, fator de exercício e fases calóricas.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_days",
    description:
      "Resumo diário calculado pela app: comido (kcal e macros), alvo, 'Falta', saldo, exercício bruto e ajustado, peso, passos, sono, corrida do dia e notas. Máx. 62 dias.",
    input_schema: { type: "object", properties: { ...dateProps, include_notes: { type: "boolean", description: "Incluir notas do dia (texto longo)." } }, required: ["start", "end"] },
  },
  {
    name: "get_meals",
    description: "Refeições e itens de um dia (descrição, quantidade, kcal, macros, se o peso foi confirmado ou assumido, se está a rever).",
    input_schema: { type: "object", properties: { date: { type: "string" } }, required: ["date"] },
  },
  {
    name: "get_activities",
    description: "Treinos num intervalo: tipo, distância, duração, ritmo, FC média/máx, custo cardíaco, kcal Garmin, subida, treino planeado ligado, condições e sensação.",
    input_schema: { type: "object", properties: dateProps, required: ["start", "end"] },
  },
  {
    name: "get_activity_detail",
    description: "Voltas e parciais por km de um treino (tempo, ritmo, FC, subida/descida, rumo) e o alvo do plano.",
    input_schema: { type: "object", properties: { activity_id: { type: "string" } }, required: ["activity_id"] },
  },
  {
    name: "get_plan",
    description: "Treinos planeados num intervalo (tipo, distância, ritmo-alvo, FC-alvo, estrutura, estado) e o plano de força.",
    input_schema: { type: "object", properties: dateProps, required: ["start", "end"] },
  },
  {
    name: "get_weight_trend",
    description: "Médias semanais de peso (Seg–Dom) e Δ face à semana anterior. Não usar para previsões diárias.",
    input_schema: { type: "object", properties: dateProps, required: ["start", "end"] },
  },
  {
    name: "get_race_projection_inputs",
    description:
      "Para projetar uma prova: resultados de provas, melhores esforços recentes (≥ 5 km a ritmo forte) com projeções de Riegel já calculadas (intervalo otimista/central/conservador) e o objetivo.",
    input_schema: { type: "object", properties: { target_distance_m: { type: "number", description: "10000 ou 21097" }, lookback_days: { type: "number" } }, required: ["target_distance_m"] },
  },
];

export const SUBMIT_REVIEW_TOOL: Anthropic.Tool = {
  name: "submit_weekly_review",
  description: "Grava a revisão semanal e a proposta de ajuste da semana seguinte. As alterações só são aplicadas depois de o atleta aceitar.",
  input_schema: {
    type: "object",
    properties: {
      review_md: { type: "string", description: "Revisão em markdown (pt-PT): cumprimento, volume, sono, peso médio, nutrição, conclusões." },
      changes: {
        type: "array",
        items: {
          type: "object",
          properties: {
            action: { type: "string", enum: ["update", "add", "remove"] },
            workout_id: { type: "string", description: "Obrigatório em update/remove." },
            date: { type: "string" },
            type: { type: "string", description: "descanso, qualidade, força, fácil, longo, prova, recuperação" },
            title: { type: "string" },
            distance_km: { type: "number" },
            target_pace_min_s: { type: "number", description: "segundos por km" },
            target_pace_max_s: { type: "number" },
            target_hr_max: { type: "number" },
            structure_text: { type: "string", description: "Estrutura em texto curto (aquecimento, séries, recuperações, retorno à calma)." },
            reason: { type: "string" },
          },
          required: ["action", "reason"],
        },
      },
    },
    required: ["review_md", "changes"],
  },
};

type Json = Record<string, unknown>;

export async function runCoachTool(name: string, input: Json, ctx: ToolContext): Promise<unknown> {
  const { db, userId } = ctx;
  switch (name) {
    case "get_profile_and_targets": {
      const s = await settings(ctx);
      const { data: races } = await db.from("races").select("name, date, distance_m, goal_time_s, result_time_s, is_main").eq("user_id", userId).order("date");
      const p = s.profile;
      return {
        today: todayInTz(),
        profile: p && {
          age: p.age,
          height_cm: p.height_cm,
          start_weight_kg: p.start_weight_kg,
          start_date: p.start_date,
          goals: { "10k": formatDuration(p.goal_10k_s), half: formatDuration(p.goal_hm_s) },
          current_marks: { "10k_pace": formatPace((p.pb_10k_pace_s ?? 0) / 60), half: formatDuration(p.pb_hm_s) },
          zones: {
            easy_pace: `${formatPace((p.easy_pace_min_s ?? 0) / 60)}–${formatPace((p.easy_pace_max_s ?? 0) / 60)}/km`,
            easy_hr_max: p.easy_hr_max,
            threshold_hr: `${p.threshold_hr_min}–${p.threshold_hr_max}`,
            max_hr: p.max_hr,
          },
          weekly_template: p.weekly_template,
        },
        energy: s.energy,
        calorie_phases: s.phases.map(({ start_date, end_date, base_kcal, note }) => ({ start_date, end_date, base_kcal, note })),
        races: (races ?? []).map((r: Json) => ({ ...r, goal: formatDuration(r.goal_time_s as number), result: formatDuration(r.result_time_s as number) })),
      };
    }
    case "get_days": {
      const { start, end } = range(input);
      const days = await loadDays(db, start, end, await settings(ctx), true, userId);
      return days.map((d) => ({
        date: d.date,
        eaten: d.summary.eaten,
        target: d.summary.target,
        remaining: d.summary.remaining,
        balance_kcal: d.summary.balance_kcal,
        exercise_kcal_raw: d.summary.exercise_kcal_raw,
        exercise_kcal_adjusted: d.summary.exercise_kcal_adj,
        phase_base_kcal: d.summary.phase_base_kcal,
        weight_kg: d.weight_kg,
        steps: d.steps,
        resting_hr: d.resting_hr,
        hrv: d.hrv,
        sleep: d.sleep && { total: formatMinutes(d.sleep.total_min), deep: formatMinutes(d.sleep.deep_min), light: formatMinutes(d.sleep.light_min), rem: formatMinutes(d.sleep.rem_min), awake: formatMinutes(d.sleep.awake_min), score: d.sleep.score, source: d.sleep.source },
        run: d.run_distance_km ? { km: d.run_distance_km, pace: formatPace(d.run_pace), avg_hr: d.run_avg_hr } : null,
        activities: d.activities.map((a) => a.type),
        notes: input.include_notes ? d.notes?.slice(0, 1500) : undefined,
      }));
    }
    case "get_meals": {
      if (!isISODate(input.date)) return { error: "date inválida" };
      const { data } = await db.from("meals").select("label, eaten_at, notes, meal_items(description, quantity, unit, kcal, protein_g, carbs_g, fat_g, fiber_g, weight_confirmed, needs_review, source)").eq("user_id", userId).eq("date", input.date);
      return data ?? [];
    }
    case "get_activities": {
      const { start, end } = range(input, 14);
      const { data } = await db
        .from("activities")
        .select("id, name, type, local_date, start_time, distance_m, duration_s, moving_time_s, avg_hr, max_hr, kcal_raw, ascent_m, descent_m, training_effect, conditions, feel, source, planned_workouts(title, type, distance_km, target_pace_min_s, target_pace_max_s, target_hr_max)")
        .eq("user_id", userId)
        .gte("local_date", start)
        .lte("local_date", end)
        .order("start_time");
      return (data ?? []).map((a: Json) => {
        const pace = paceFromDistance(a.distance_m as number, (a.moving_time_s ?? a.duration_s) as number);
        return { ...a, distance_km: a.distance_m ? Math.round((a.distance_m as number) / 100) / 10 : null, duration: formatDuration((a.moving_time_s ?? a.duration_s) as number), pace: formatPace(pace), cardiac_cost: a.type === "corrida" ? cardiacCost(a.avg_hr as number, pace) : null };
      });
    }
    case "get_activity_detail": {
      const id = String(input.activity_id ?? "");
      const { data: act } = await db.from("activities").select("id, name, type, local_date, distance_m, moving_time_s, duration_s, avg_hr, max_hr, conditions, feel, planned_workouts(title, structure, target_pace_min_s, target_pace_max_s, target_hr_max)").eq("user_id", userId).eq("id", id).maybeSingle();
      if (!act) return { error: "Treino não encontrado" };
      const { data: laps } = await db.from("activity_laps").select("kind, idx, label, distance_m, duration_s, avg_hr, max_hr, ascent_m, descent_m, bearing_deg").eq("activity_id", id).order("kind").order("idx");
      return {
        activity: act,
        laps: (laps ?? []).map((l: Json) => ({ ...l, pace: formatPace(paceFromDistance(l.distance_m as number, l.duration_s as number)) })),
      };
    }
    case "get_plan": {
      const { start, end } = range(input, 14);
      const [{ data: workouts }, { data: strength }] = await Promise.all([
        db.from("planned_workouts").select("id, date, phase, week_index, type, title, distance_km, target_pace_min_s, target_pace_max_s, target_hr_min, target_hr_max, structure, status, change_reason").eq("user_id", userId).gte("date", start).lte("date", end).order("date"),
        db.from("strength_sessions").select("name, day_of_week, notes, strength_exercises(name, sets, reps, load_kg, superset, notes)").eq("user_id", userId),
      ]);
      return {
        workouts: (workouts ?? []).map((w: Json) => ({ ...w, target_pace: w.target_pace_min_s ? `${formatPace((w.target_pace_min_s as number) / 60)}–${formatPace((w.target_pace_max_s as number) / 60)}/km` : null })),
        strength,
      };
    }
    case "get_weight_trend": {
      const { start, end } = range(input, 28);
      const { data } = await db.from("days").select("date, weight_kg").eq("user_id", userId).gte("date", start).lte("date", end).order("date");
      return weeklyWeightAverages(((data ?? []) as Array<{ date: string; weight_kg: number | null }>).map((d) => ({ date: d.date, weight_kg: d.weight_kg === null ? null : Number(d.weight_kg) })));
    }
    case "get_race_projection_inputs": {
      const target = Number(input.target_distance_m) || 21097;
      const lookback = Math.min(Number(input.lookback_days) || 56, 120);
      const since = addDays(todayInTz(), -lookback);
      const [{ data: races }, { data: acts }, s] = await Promise.all([
        db.from("races").select("name, date, distance_m, result_time_s, goal_time_s").eq("user_id", userId).order("date"),
        db.from("activities").select("id, name, local_date, distance_m, moving_time_s, duration_s, avg_hr, type").eq("user_id", userId).eq("type", "corrida").gte("local_date", since),
        settings(ctx),
      ]);
      const thresholdHr = s.profile?.threshold_hr_min ?? 162;
      type Act = { id: string; name: string | null; local_date: string; distance_m: number; moving_time_s: number | null; duration_s: number | null; avg_hr: number | null };
      const efforts = ((acts ?? []) as Act[])
        .map((a) => ({ ...a, time_s: (a.moving_time_s ?? a.duration_s) as number, pace: paceFromDistance(a.distance_m as number, (a.moving_time_s ?? a.duration_s) as number) }))
        .filter((a) => (a.distance_m as number) >= 5000 && a.time_s && ((a.avg_hr as number) >= thresholdHr - 5 || (a.pace ?? 9) < 4.5))
        .map((a) => {
          const p = riegelProjection(a.distance_m as number, a.time_s, target);
          return { date: a.local_date, name: a.name, km: Math.round((a.distance_m as number) / 100) / 10, time: formatDuration(a.time_s), pace: formatPace(a.pace), avg_hr: a.avg_hr, projection: { optimistic: formatDuration(p.optimistic_s), central: formatDuration(p.central_s), conservative: formatDuration(p.conservative_s) } };
        });
      const raceResults = ((races ?? []) as Json[])
        .filter((r) => r.result_time_s)
        .map((r) => {
          const p = riegelProjection(r.distance_m as number, r.result_time_s as number, target);
          return { name: r.name, date: r.date, result: formatDuration(r.result_time_s as number), projection: { optimistic: formatDuration(p.optimistic_s), central: formatDuration(p.central_s), conservative: formatDuration(p.conservative_s) } };
        });
      return {
        target_distance_m: target,
        method: "Riegel t2 = t1 × (d2/d1)^k, k = 1,04 (otimista) / 1,06 (central) / 1,08 (conservador). Esforços de treino subestimam o potencial de prova (sem afinamento nem dorsal).",
        race_results: raceResults,
        recent_hard_efforts: efforts,
      };
    }
    default:
      return { error: `Ferramenta desconhecida: ${name}` };
  }
}
