/**
 * Gerador do plano de treino até 20/12/2026 (função pura, testada).
 *
 * Periodização: específica (meia) → afinamento → prova → recuperação → específica (10 km) → afinamento → prova.
 * Semana tipo: Seg descanso · Ter qualidade · Qua força · Qui fácil · Sex força · Sáb fácil · Dom longo.
 * ~80 % fácil / 20 % intenso. Os ritmos-alvo vêm dos objetivos e das zonas do perfil.
 */
import { addDays, weekdayMon0, type ISODate } from "../calc/dates";
import type { WorkoutStep } from "../types";

export interface PlanProfile {
  easy_pace_min_s: number; // 5:30
  easy_pace_max_s: number; // 5:55
  easy_hr_max: number; // 150
  threshold_hr_min: number; // 162
  threshold_hr_max: number; // 175
  goal_hm_s: number; // 1:30:00
  goal_10k_s: number; // 40:00
}

export interface PlannedWorkoutInput {
  date: ISODate;
  phase: string;
  week_index: number;
  type: "descanso" | "qualidade" | "força" | "fácil" | "longo" | "prova" | "recuperação";
  title: string;
  distance_km: number | null;
  target_pace_min_s: number | null;
  target_pace_max_s: number | null;
  target_hr_min: number | null;
  target_hr_max: number | null;
  structure: WorkoutStep[];
  strength_day?: number; // dia da semana da sessão de força (para ligar à sessão)
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

type DaySpec = Omit<PlannedWorkoutInput, "date" | "phase" | "week_index">;

export function generatePlan(p: PlanProfile, start: ISODate = "2026-11-09", end: ISODate = "2026-12-20"): PlannedWorkoutInput[] {
  const hm = Math.round(p.goal_hm_s / 21.0975); // ~4:16/km
  const tenK = Math.round(p.goal_10k_s / 10); // 4:00/km
  const easy = { target_pace_min_s: p.easy_pace_min_s, target_pace_max_s: p.easy_pace_max_s, target_hr_min: null, target_hr_max: p.easy_hr_max };
  const easyTxt = `${fmt(p.easy_pace_min_s)}–${fmt(p.easy_pace_max_s)}/km, FC < ${p.easy_hr_max}`;

  const rest: DaySpec = { type: "descanso", title: "Descanso", distance_km: null, target_pace_min_s: null, target_pace_max_s: null, target_hr_min: null, target_hr_max: null, structure: [{ kind: "nota", description: "Descanso total ou mobilidade 10 min." }] };
  const easyRun = (km: number, extra?: string): DaySpec => ({
    type: "fácil",
    title: `Fácil ${km} km${extra ? " + " + extra : ""}`,
    distance_km: km,
    ...easy,
    structure: [{ kind: "contínuo", description: `${km} km a ${easyTxt}` }, ...(extra ? [{ kind: "série" as const, description: extra }] : [])],
  });
  const strength = (dow: number, light = false): DaySpec => ({
    type: "força",
    title: dow === 2 ? "Força — Pernas + Peito" : "Força — Estabilidade + Braços",
    distance_km: null,
    target_pace_min_s: null,
    target_pace_max_s: null,
    target_hr_min: null,
    target_hr_max: null,
    structure: [{ kind: "força", description: light ? "Semana de afinamento: confirmar volume com o plano." : "Ver plano de força." }],
    strength_day: dow,
  });
  const quality = (title: string, km: number, reps: number, repDist: string, pace: number, rec: string): DaySpec => ({
    type: "qualidade",
    title,
    distance_km: km,
    target_pace_min_s: pace - 3,
    target_pace_max_s: pace + 3,
    target_hr_min: p.threshold_hr_min,
    target_hr_max: p.threshold_hr_max,
    structure: [
      { kind: "aquecimento", description: `2 km fácil (${easyTxt}) + 4 acelerações de 20 s` },
      { kind: "série", repeat: reps, description: `${repDist} a ${fmt(pace - 3)}–${fmt(pace + 3)}/km` },
      { kind: "recuperação", description: rec },
      { kind: "retorno à calma", description: "1,5–2 km muito fácil" },
    ],
  });
  const longRun = (km: number, block?: { km: number; pace: number }): DaySpec => ({
    type: "longo",
    title: block ? `Longo ${km} km com ${block.km} km a ritmo de prova` : `Longo ${km} km fácil`,
    distance_km: km,
    ...easy,
    structure: block
      ? [
          { kind: "contínuo", description: `${km - block.km - 2} km a ${easyTxt}` },
          { kind: "série", description: `${block.km} km a ${fmt(block.pace)}/km (ritmo de prova)` },
          { kind: "retorno à calma", description: "2 km fácil" },
        ]
      : [{ kind: "contínuo", description: `${km} km a ${easyTxt}` }],
  });
  const race = (name: string, km: number, pace: number): DaySpec => ({
    type: "prova",
    title: name,
    distance_km: km,
    target_pace_min_s: pace - 2,
    target_pace_max_s: pace + 2,
    target_hr_min: null,
    target_hr_max: null,
    structure: [
      { kind: "aquecimento", description: "10–15 min fácil + 3 acelerações" },
      { kind: "contínuo", description: `${km} km a ${fmt(pace)}/km (começar 2–3 s/km mais lento no 1.º km)` },
    ],
  });

  // Semanas a partir de segunda 09/11/2026.
  const weeks: Array<{ phase: string; days: DaySpec[] }> = [
    {
      phase: "específica",
      days: [rest, quality("6 × 1000 m a ritmo de 10 km", 11, 6, "1000 m", tenK + 10, "2 min a trote"), strength(2), easyRun(9), strength(4), easyRun(8), longRun(18, { km: 6, pace: hm })],
    },
    {
      phase: "afinamento",
      days: [rest, quality("5 × 1000 m a ritmo de meia (−5 s)", 10, 5, "1000 m", hm - 5, "90 s a trote"), strength(2, true), easyRun(8), strength(4, true), easyRun(6), longRun(14, { km: 4, pace: hm })],
    },
    {
      phase: "afinamento",
      days: [
        rest,
        quality("4 × 1000 m a ritmo de meia", 8, 4, "1000 m", hm, "90 s a trote"),
        { ...easyRun(6), title: "Fácil 6 km (sem força nesta semana)" },
        easyRun(6, "4 × 20 s rápidas, soltas"),
        rest,
        race("Meia Maratona dos Descobrimentos", 21.1, hm),
        { ...rest, type: "recuperação", title: "Recuperação: descanso ou caminhada 30 min" },
      ],
    },
    {
      phase: "recuperação",
      days: [rest, easyRun(5), strength(2, true), easyRun(6), strength(4, true), easyRun(6, "4 × 20 s soltas"), longRun(12)],
    },
    {
      phase: "específica",
      days: [rest, quality("5 × 1000 m a ritmo de 10 km", 10, 5, "1000 m", tenK, "2 min a trote"), strength(2), easyRun(8), strength(4), easyRun(7), longRun(14)],
    },
    {
      phase: "afinamento",
      days: [
        rest,
        quality("3 × 1000 m a ritmo de 10 km + 4 × 200 m soltas", 8, 3, "1000 m", tenK, "2 min a trote; depois 4 × 200 m soltos"),
        strength(2, true),
        easyRun(6),
        rest,
        easyRun(4, "3 × 20 s soltas"),
        race("GP de Natal Benfica 10 km", 10, tenK),
      ],
    },
  ];

  const out: PlannedWorkoutInput[] = [];
  weeks.forEach((w, wi) => {
    w.days.forEach((d, di) => {
      const date = addDays(start, wi * 7 + di);
      if (date > end) return;
      out.push({ ...d, date, phase: d.type === "prova" ? "prova" : w.phase, week_index: wi + 1 });
    });
  });
  if (weekdayMon0(start) !== 0) throw new Error("O plano tem de começar a uma segunda-feira.");
  return out;
}

/** Cumprimento por semana: treinos feitos / treinos planeados (sem contar descansos). */
export function weeklyCompliance(workouts: Array<{ week_index: number | null; type: string; status: string }>) {
  const map = new Map<number, { planned: number; done: number }>();
  for (const w of workouts) {
    if (w.week_index === null || w.type === "descanso" || w.type === "recuperação") continue;
    const e = map.get(w.week_index) ?? { planned: 0, done: 0 };
    e.planned += 1;
    if (w.status === "feito") e.done += 1;
    map.set(w.week_index, e);
  }
  return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([week_index, v]) => ({ week_index, ...v, pct: v.planned ? Math.round((v.done / v.planned) * 100) : 0 }));
}
