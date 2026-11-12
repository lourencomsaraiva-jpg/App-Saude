/**
 * Regras de energia e macros (secção 6 da spec).
 *
 *   exercicio_ajustado = round(kcal_garmin × fator) para datas ≥ data_início_fator; antes disso, valor bruto
 *   saldo              = kcal_comidas − gasto_base − exercicio_ajustado
 *   alvo_kcal(dia)     = base_fase(dia) + exercicio_ajustado
 */
import type { ISODate } from "./dates";
import { round1 } from "./numbers";

export interface EnergySettings {
  baseBurnKcal: number; // gasto base (2417)
  exerciseFactor: number; // 0.95
  exerciseFactorStart: ISODate; // 2026-10-12
  proteinTargetG: number; // 155
  fiberTargetG: number; // 30
  restBaseKcal: number; // 2050 — base em que se aplicam os macros fixos de dia sem exercício
  restCarbsG: number; // 250
  restFatG: number; // 48
  ratioRefKcal: number; // 2747
  ratioCarbsG: number; // 385
  ratioFatG: number; // 65
  defaultPhaseBaseKcal: number; // usado se nenhuma fase cobrir a data
}

export const DEFAULT_ENERGY_SETTINGS: EnergySettings = {
  baseBurnKcal: 2417,
  exerciseFactor: 0.95,
  exerciseFactorStart: "2026-10-12",
  proteinTargetG: 155,
  fiberTargetG: 30,
  restBaseKcal: 2050,
  restCarbsG: 250,
  restFatG: 48,
  ratioRefKcal: 2747,
  ratioCarbsG: 385,
  ratioFatG: 65,
  defaultPhaseBaseKcal: 2050,
};

export interface CaloriePhase {
  start_date: ISODate | null; // null = desde sempre
  end_date: ISODate | null; // null = sem fim
  base_kcal: number;
  note?: string | null;
}

export function adjustedExercise(kcalRaw: number, date: ISODate, s: Pick<EnergySettings, "exerciseFactor" | "exerciseFactorStart">): number {
  if (!kcalRaw) return 0;
  if (date >= s.exerciseFactorStart) return Math.round(kcalRaw * s.exerciseFactor);
  return kcalRaw;
}

export function caloricBalance(eatenKcal: number, baseBurnKcal: number, exerciseAdjKcal: number): number {
  return round1(eatenKcal - baseBurnKcal - exerciseAdjKcal);
}

function phaseLength(p: CaloriePhase): number {
  const start = p.start_date ? Date.parse(p.start_date) : -8.64e15;
  const end = p.end_date ? Date.parse(p.end_date) : 8.64e15;
  return end - start;
}

/**
 * Fase calórica de um dia. Se várias fases cobrirem a data, ganha a mais curta
 * (assim uma exceção de um dia, como 07/11, sobrepõe-se ao período geral).
 */
export function phaseFor(date: ISODate, phases: CaloriePhase[]): CaloriePhase | null {
  const covering = phases.filter((p) => (!p.start_date || p.start_date <= date) && (!p.end_date || date <= p.end_date));
  if (covering.length === 0) return null;
  return covering.sort((a, b) => phaseLength(a) - phaseLength(b))[0];
}

export function basePhaseKcal(date: ISODate, phases: CaloriePhase[], s: Pick<EnergySettings, "defaultPhaseBaseKcal">): number {
  return phaseFor(date, phases)?.base_kcal ?? s.defaultPhaseBaseKcal;
}

export function kcalTarget(date: ISODate, exerciseAdjKcal: number, phases: CaloriePhase[], s: Pick<EnergySettings, "defaultPhaseBaseKcal">): number {
  return basePhaseKcal(date, phases, s) + exerciseAdjKcal;
}

export interface MacroTargets {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
}

/**
 * Macros-alvo:
 *  - proteína e fibra fixas;
 *  - dia sem exercício com base igual à base de descanso (2050): hidratos 250 g, gordura 48 g;
 *  - restantes dias: hidratos = alvo × 385/2747; gordura = alvo × 65/2747.
 */
export function macroTargets(targetKcal: number, exerciseAdjKcal: number, baseKcal: number, s: EnergySettings): MacroTargets {
  const restDay = exerciseAdjKcal <= 0 && baseKcal === s.restBaseKcal;
  return {
    kcal: targetKcal,
    protein_g: s.proteinTargetG,
    fiber_g: s.fiberTargetG,
    carbs_g: restDay ? s.restCarbsG : round1((targetKcal * s.ratioCarbsG) / s.ratioRefKcal),
    fat_g: restDay ? s.restFatG : round1((targetKcal * s.ratioFatG) / s.ratioRefKcal),
  };
}

/** "Falta" = alvo − comido. Negativo significa excedido. */
export function remaining(target: number, eaten: number): number {
  return round1(target - eaten);
}
