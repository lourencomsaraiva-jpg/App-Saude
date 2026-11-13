/**
 * Plano de treino do atleta — "Plano de Treino (Ajustado) Agosto — Dezembro 2026"
 * (reajustado a 6/9/2026; foco: Meia Maratona dos Descobrimentos). Transcrito do documento do atleta.
 *
 * Semana tipo: Seg descanso · Ter qualidade · Qua força · Qui fácil · Sex força · Sáb fácil · Dom longo.
 * As distâncias totais são estimadas (≈) a partir do corpo em km + aquecimento/desaquecimento em minutos;
 * o texto original de cada sessão fica na estrutura.
 */
import { addDays, type ISODate } from "../calc/dates";
import type { PlannedWorkoutInput } from "./generate";

const PLAN_START: ISODate = "2026-08-24"; // segunda da semana 1

/** Zonas do plano (segundos por km). */
export const ZONES = {
  E: [330, 355], // Fácil 5:30–5:55
  M: [290, 310], // Moderado 4:50–5:10
  T: [260, 280], // Limiar/Tempo 4:20–4:40
  RHM: [250, 265], // Ritmo meia 4:10–4:25 (meta 4:15)
  R10: [235, 250], // Ritmo 10 km 3:55–4:10
  I: [220, 235], // VO2max 3:40–3:55
} as const;

type Kind = "qualidade" | "fácil" | "longo" | "prova" | "recuperação";
interface S {
  t: Kind;
  title: string;
  km: number | null;
  pace?: readonly [number, number];
  hr?: number | null;
  aq?: string;
  corpo: string;
  desaq?: string;
}

const AQ10 = "10min fácil (5:55-6:15/km)";
const AQ15 = "15min fácil (5:30-5:55/km)";
const AQ15S = "15min fácil (5:30-5:55/km) + 3-4 strides";
const AQL = "10-15min fácil (5:55-6:15/km)";
const DQ5 = "5min fácil (5:55-6:15/km)";
const DQ10 = "10min fácil (5:55-6:15/km)";
const DQL = "5-10min fácil (5:55-6:15/km)";
const POS = "10min trote leve pós-prova";

const easy = (km: number, corpo: string, total: number, aq = AQ10, desaq = DQ5): S => ({ t: "fácil", title: corpo, km: total, pace: ZONES.E, hr: 150, aq, corpo, desaq });
const long = (corpo: string, total: number, title = corpo, pace: readonly [number, number] = ZONES.E): S => ({ t: "longo", title, km: total, pace, hr: null, aq: AQL, corpo, desaq: DQL });

interface Week {
  n: number;
  phase: string;
  label: string;
  tue: S;
  thu: S;
  sat: S;
  sun: S;
}

const F1 = "Fase 1 — Reconstrução pós-doença";
const F2 = "Fase 2 — Meia Maratona (build)";
const F3 = "Fase 3 — Afinar + taper meia";
const F4 = "Fase 4 — Afiar 10 km";

export const WEEKS: Week[] = [
  {
    n: 1, phase: F1, label: "24–30 Ago",
    tue: { t: "qualidade", title: "3×5min a T", km: 7, pace: ZONES.T, hr: 175, aq: AQ15, corpo: "3×5min a T (4:20-4:40/km) c/2min fácil entre reps. Total ~7km.", desaq: DQ10 },
    thu: easy(6, "6km a fácil (5:30-5:55/km)", 8.5),
    sat: easy(6, "6km a fácil (5:30-5:55/km)", 8.5),
    sun: long("8km a fácil (5:30-5:55/km) — retoma gradual", 10.5, "Longo 8km fácil — retoma gradual"),
  },
  {
    n: 2, phase: F1, label: "31 Ago–6 Set",
    tue: { t: "qualidade", title: "4×4min a T", km: 7, pace: ZONES.T, hr: 175, aq: AQ15, corpo: "4×4min a T (4:20-4:40/km) c/2min fácil. Total ~7km.", desaq: DQ10 },
    thu: easy(7, "7km a fácil (5:30-5:55/km)", 9.5),
    sat: easy(7, "7km a fácil (5:30-5:55/km)", 9.5),
    sun: long("10km a fácil (5:30-5:55/km)", 13, "Longo 10km fácil"),
  },
  {
    n: 3, phase: F1, label: "7–13 Set (taper Tejo)",
    tue: { t: "qualidade", title: "3×3min a T controlado + 4 strides", km: 6.5, pace: ZONES.T, hr: 175, aq: AQ15, corpo: "3×3min a T controlado (não máximo) + 4 strides.", desaq: DQ10 },
    thu: easy(5, "5km a fácil + 4 strides", 7.5),
    sat: easy(4, "4km a fácil + 4 strides", 6.5),
    sun: { t: "prova", title: "🏁 Corrida do Tejo 10km", km: 10, corpo: "PROVA: Corrida do Tejo 10km — sem objetivo de tempo, corre por sensações; checkpoint de forma, não teste de velocidade.", desaq: POS },
  },
  {
    n: 4, phase: F2, label: "15–20 Set (recup. pós-Tejo)",
    tue: easy(3.5, "20min a fácil (5:30-5:55/km), muito leve", 6),
    thu: easy(7, "7km a fácil (5:30-5:55/km)", 9.5),
    sat: easy(7, "7km a fácil (5:30-5:55/km)", 9.5),
    sun: long("10km a fácil (5:30-5:55/km)", 13, "Longo 10km fácil"),
  },
  {
    n: 5, phase: F2, label: "22–27 Set",
    tue: { t: "qualidade", title: "Tempo contínuo 20min a T", km: 8, pace: ZONES.T, hr: 175, aq: AQ15, corpo: "Tempo contínuo 20min (T: 4:20-4:40/km). Total ~8km.", desaq: DQ10 },
    thu: easy(8, "8km a fácil (5:30-5:55/km)", 10.5),
    sat: easy(8, "8km a fácil (5:30-5:55/km)", 10.5),
    sun: long("15-16km a fácil (5:30-5:55/km) — subido face ao original para preparar melhor a Meia de Lisboa", 18.5, "Longo 15-16km fácil"),
  },
  {
    n: 6, phase: F2, label: "29 Set–4 Out",
    tue: { t: "qualidade", title: "5×1000m a T c/90s trote", km: 9.5, pace: ZONES.T, hr: 175, aq: AQ15, corpo: "5×1000m (T: 4:20-4:40/km) c/90s trote.", desaq: DQ10 },
    thu: easy(8, "8km a fácil (5:30-5:55/km)", 10.5),
    sat: easy(8, "8km a fácil (5:30-5:55/km) + 4-6 strides ~20s progressivos no final (controlado, não sprint)", 10.5),
    sun: long("17-18km a fácil (5:30-5:55/km) + 15min final a Moderado (4:55-5:15/km) — subido face ao original para preparar melhor a Meia de Lisboa", 21, "Longo 17-18km fácil + 15min a Moderado"),
  },
  {
    n: 7, phase: F2, label: "6–11 Out (taper Lisboa)",
    tue: { t: "fácil", title: "15min fácil + 4 strides", km: 6, pace: ZONES.E, hr: 150, aq: AQ15, corpo: "15min fácil + 4 strides — reduzir carga, sem sessão forte.", desaq: DQ5 },
    thu: easy(3.5, "20min fácil + 4 strides — muito leve", 6),
    sat: easy(3, "15-20min fácil + 4 strides — shakeout pré-prova", 5.5),
    sun: { t: "prova", title: "🏁 Meia Maratona de Lisboa (Hyundai Half)", km: 21.1, corpo: "PROVA: Meia Maratona de Lisboa — esforço controlado/tempo forte, ensaio geral para o Descobrimentos, NÃO all-out. Protege a recuperação para as 7 semanas seguintes.", desaq: POS },
  },
  {
    n: 8, phase: F2, label: "13–18 Out (recup. pós-Lisboa)",
    tue: easy(3.5, "20min a fácil (5:30-5:55/km), muito leve", 6),
    thu: easy(6.5, "6-7km a fácil (5:30-5:55/km)", 9),
    sat: easy(6.5, "6-7km a fácil (5:30-5:55/km)", 9),
    sun: long("10-12km a fácil (5:30-5:55/km) — recuperação, sem pressa", 14, "Longo 10-12km fácil (recuperação)"),
  },
  {
    n: 9, phase: F2, label: "20–25 Out (qualidade)",
    tue: { t: "qualidade", title: "5×1000m a 4:15-4:20/km c/90s trote", km: 9.5, pace: [255, 260], hr: 175, aq: AQ15S, corpo: "5×1000m a 4:15-4:20/km c/90s trote (substitui o teste 1500m — FC máx 185 já medida na Meia de Lisboa).", desaq: DQ10 },
    thu: easy(7, "7km a fácil (5:30-5:55/km)", 9.5),
    sat: easy(9, "9km a fácil (5:30-5:55/km)", 11.5),
    sun: long("16km: 10km a fácil (5:30-5:55/km) + 6km finais a RHM 4:20/km", 18.5, "Longo 16km: 10 fácil + 6 a RHM 4:20"),
  },
  {
    n: 10, phase: F2, label: "27 Out–1 Nov",
    tue: { t: "qualidade", title: "3×3km a RHM 4:18-4:20/km c/2min trote", km: 13.5, pace: [258, 260], hr: 175, aq: AQ15S, corpo: "3×3km a RHM 4:18-4:20/km c/2min trote (9km a RHM).", desaq: DQ10 },
    thu: easy(9, "9km a fácil (5:30-5:55/km)", 11.5),
    sat: easy(9, "9km a fácil (5:30-5:55/km)", 11.5),
    sun: long("20km: 10km a fácil + 10km finais a RHM 4:20-4:25/km", 22.5, "Longo 20km: 10 fácil + 10 a RHM 4:20-4:25"),
  },
  {
    n: 11, phase: F2, label: "3–8 Nov (TESTE)",
    tue: { t: "qualidade", title: "6×800m a 4:00-4:05/km c/400m trote", km: 11, pace: [240, 245], hr: null, aq: "15-20min fácil (5:30-5:55/km) + 4 strides", corpo: "6×800m a 4:00-4:05/km c/400m trote (afinação antes do teste de domingo).", desaq: DQ10 },
    thu: easy(3.5, "leve/mobilidade 20min a fácil (5:30-5:55/km)", 5.5),
    sat: { t: "fácil", title: "4-6 strides ~20s progressivos", km: 4.5, pace: ZONES.E, hr: 150, aq: AQ15, corpo: "4-6 strides ~20s progressivos (controlado)", desaq: DQ5 },
    sun: {
      t: "longo", title: "🎯 Teste 18km progressivo: 10 fácil + 8 a 4:20-4:25", km: 21.5, pace: [260, 265], hr: 175, aq: AQ15,
      corpo: "Teste 18km progressivo: 10km fácil (5:30-5:55/km) + 8km a 4:20-4:25/km (ritmo-alvo RHM revisto; alterado a 3/11 após a sessão de 1/11 com vento). Recalibra RHM para a fase final. Se a FC passar de 175 antes do km 14, baixar para 4:30.",
      desaq: DQ10,
    },
  },
  {
    n: 12, phase: F3, label: "10–15 Nov",
    tue: { t: "qualidade", title: "2×5km a RHM ajustado c/3min trote", km: 15, pace: ZONES.RHM, hr: 175, aq: AQ15S, corpo: "2×5km a RHM ajustado (pós-teste) c/3min trote.", desaq: DQ10 },
    thu: easy(8, "8km a fácil (5:30-5:55/km)", 10.5),
    sat: easy(9, "9km a fácil (5:30-5:55/km)", 11.5),
    sun: long("22km: 12km a fácil + 10km a RHM ajustado — LONGO MÁXIMO do ciclo", 24.5, "Longo 22km: 12 fácil + 10 a RHM — longo máximo"),
  },
  {
    n: 13, phase: F3, label: "17–22 Nov",
    tue: { t: "qualidade", title: "4×2000m a RHM ajustado −5s/km c/2min trote", km: 14, pace: [245, 260], hr: 175, aq: AQ15S, corpo: "4×2000m a RHM ajustado −5s/km c/2min trote.", desaq: DQ10 },
    thu: easy(7, "7km a fácil (5:30-5:55/km)", 9.5),
    sat: { t: "fácil", title: "4-6 strides ~20s progressivos", km: 4, pace: ZONES.E, hr: 150, aq: AQ10, corpo: "4-6 strides ~20s progressivos (controlado)", desaq: DQ5 },
    sun: long("12km a fácil (5:30-5:55/km) — início do taper", 14.5, "Longo 12km fácil — início do taper"),
  },
  {
    n: 14, phase: F3, label: "24–28 Nov (taper)",
    tue: { t: "qualidade", title: "4×1000m a RHM controlado + 4 strides", km: 9, pace: ZONES.RHM, hr: 175, aq: AQ15, corpo: "4×1000m a RHM ajustado, ritmo controlado (não máximo) + 4 strides.", desaq: DQ10 },
    thu: { t: "fácil", title: "20min fácil + 4-6 strides", km: 5, pace: ZONES.E, hr: 150, aq: "20min fácil (5:30-5:55/km)", corpo: "4-6 strides ~20s progressivos (controlado)", desaq: DQ5 },
    sat: { t: "prova", title: "🏁 Meia Maratona dos Descobrimentos", km: 21.1, pace: [253, 257], corpo: "PROVA: Meia Maratona dos Descobrimentos — objetivo RHM ~4:15/km (revisto após o Tejo; PB era 4:38/km).", desaq: POS },
    sun: { t: "recuperação", title: "Descanso total / caminhada leve pós-prova", km: null, corpo: "Descanso total / caminhada leve pós-prova" },
  },
  {
    n: 15, phase: F4, label: "1–6 Dez (recup.)",
    tue: easy(3.5, "20min a fácil (5:30-5:55/km)", 6),
    thu: easy(6, "6km a fácil (5:30-5:55/km)", 8.5),
    sat: easy(6, "6km a fácil (5:30-5:55/km)", 8.5),
    sun: long("10km a fácil (5:30-5:55/km)", 13, "Longo 10km fácil"),
  },
  {
    n: 16, phase: F4, label: "8–13 Dez",
    tue: { t: "qualidade", title: "6×400m a I + 4×1000m a R10", km: 11, pace: ZONES.R10, hr: null, aq: AQ15, corpo: "6×400m (I: 3:40-3:55/km) c/200m trote + 4×1000m (R10: 3:55-4:10/km) c/90s trote.", desaq: DQ10 },
    thu: easy(7, "7km a fácil (5:30-5:55/km)", 9.5),
    sat: easy(6, "6km fácil (5:30-5:55/km) + 4 strides finais", 8.5),
    sun: long("10km: últimos 3km a Ritmo 10km (4:00-4:15/km)", 12.5, "Longo 10km: últimos 3 a ritmo 10 km"),
  },
  {
    n: 17, phase: F4, label: "15–20 Dez (taper)",
    tue: { t: "qualidade", title: "5×300m a I controlado + 4 strides", km: 6.5, pace: [225, 240], hr: null, aq: AQ15, corpo: "5×300m (I: 3:45-4:00/km) ritmo controlado + 4 strides.", desaq: DQ10 },
    thu: { t: "fácil", title: "4-6 strides ~20s progressivos", km: 5, pace: ZONES.E, hr: 150, aq: AQ15, corpo: "4-6 strides ~20s progressivos (controlado)", desaq: DQ5 },
    sat: { t: "fácil", title: "4-6 strides ~20s progressivos", km: 4, pace: ZONES.E, hr: 150, aq: "10min fácil (5:30-5:55/km)", corpo: "4-6 strides ~20s progressivos (controlado)", desaq: DQ5 },
    sun: { t: "prova", title: "🏁 Grande Prémio de Natal em Benfica 10km", km: 10, pace: [235, 240], corpo: "PROVA: Grande Prémio de Natal em Benfica 10km — PB de 10 km.", desaq: POS },
  },
];

function toInput(date: ISODate, week: Week, s: S): PlannedWorkoutInput {
  return {
    date,
    phase: week.phase,
    week_index: week.n,
    type: s.t,
    title: s.title,
    distance_km: s.km,
    target_pace_min_s: s.pace?.[0] ?? null,
    target_pace_max_s: s.pace?.[1] ?? null,
    target_hr_min: null,
    target_hr_max: s.hr ?? null,
    structure: [
      ...(s.aq ? [{ kind: "aquecimento" as const, description: s.aq }] : []),
      { kind: s.t === "prova" || s.t === "recuperação" ? ("nota" as const) : ("série" as const), description: s.corpo },
      ...(s.desaq ? [{ kind: "retorno à calma" as const, description: s.desaq }] : []),
      ...(s.km && s.t !== "prova" ? [{ kind: "nota" as const, description: `Distância total estimada ≈ ${String(s.km).replace(".", ",")} km (com aquecimento e desaquecimento).` }] : []),
    ],
  };
}

/** Todos os dias do plano, de 24/08 a 20/12/2026 (força às quartas e sextas, segunda descanso). */
export function buildAthletePlan(): PlannedWorkoutInput[] {
  const out: PlannedWorkoutInput[] = [];
  for (const w of WEEKS) {
    const mon = addDays(PLAN_START, (w.n - 1) * 7);
    const d = (i: number) => addDays(mon, i);
    out.push({ date: d(0), phase: w.phase, week_index: w.n, type: "descanso", title: "Descanso total", distance_km: null, target_pace_min_s: null, target_pace_max_s: null, target_hr_min: null, target_hr_max: null, structure: [{ kind: "nota", description: "Segunda — descanso total (opcional: Core & Mobilidade ~15 min em semanas com boa energia)." }] });
    out.push(toInput(d(1), w, w.tue));
    out.push({ date: d(2), phase: w.phase, week_index: w.n, type: "força", title: "Força — Pernas + Peito", distance_km: null, target_pace_min_s: null, target_pace_max_s: null, target_hr_min: null, target_hr_max: null, structure: [{ kind: "força", description: "Ver plano de força (~25 min)." }], strength_day: 2 });
    out.push(toInput(d(3), w, w.thu));
    out.push({ date: d(4), phase: w.phase, week_index: w.n, type: "força", title: "Força — Estabilidade + Braços", distance_km: null, target_pace_min_s: null, target_pace_max_s: null, target_hr_min: null, target_hr_max: null, structure: [{ kind: "força", description: "Ver plano de força (~25 min)." }], strength_day: 4 });
    out.push(toInput(d(5), w, w.sat));
    out.push(toInput(d(6), w, w.sun));
  }
  return out;
}
