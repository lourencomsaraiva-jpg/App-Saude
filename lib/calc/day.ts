/**
 * Resumo de um dia: totais comidos, exercício (bruto e ajustado), alvo, macros-alvo, "Falta" e saldo.
 * É a ÚNICA função que a interface, a exportação e a IA usam para estes números.
 */
import type { ISODate } from "./dates";
import { adjustedExercise, basePhaseKcal, caloricBalance, macroTargets, remaining, type CaloriePhase, type EnergySettings, type MacroTargets } from "./energy";
import { sum } from "./numbers";
import { sumNutrients, type Nutrients } from "./nutrition";

export interface DayInput {
  date: ISODate;
  items: Nutrients[];
  /** kcal brutas (Garmin) de cada atividade do dia. */
  activityKcalRaw: Array<number | null>;
  /** Valor bruto introduzido à mão / importado do histórico; prevalece sobre a soma das atividades. */
  exerciseKcalRawOverride?: number | null;
}

export interface DaySummary {
  date: ISODate;
  eaten: { kcal: number; protein_g: number | null; carbs_g: number | null; fat_g: number | null; fiber_g: number | null };
  base_burn_kcal: number;
  exercise_kcal_raw: number;
  exercise_kcal_adj: number;
  phase_base_kcal: number;
  target: MacroTargets;
  remaining: { kcal: number; protein_g: number; carbs_g: number; fat_g: number; fiber_g: number };
  balance_kcal: number;
  protein_on_target: boolean;
}

export function summarizeDay(input: DayInput, settings: EnergySettings, phases: CaloriePhase[]): DaySummary {
  const eaten = sumNutrients(input.items);
  const exerciseRaw =
    input.exerciseKcalRawOverride !== null && input.exerciseKcalRawOverride !== undefined
      ? input.exerciseKcalRawOverride
      : sum(input.activityKcalRaw);
  const exerciseAdj = adjustedExercise(exerciseRaw, input.date, settings);
  const phaseBase = basePhaseKcal(input.date, phases, settings);
  const target = macroTargets(phaseBase + exerciseAdj, exerciseAdj, phaseBase, settings);
  return {
    date: input.date,
    eaten,
    base_burn_kcal: settings.baseBurnKcal,
    exercise_kcal_raw: exerciseRaw,
    exercise_kcal_adj: exerciseAdj,
    phase_base_kcal: phaseBase,
    target,
    remaining: {
      kcal: remaining(target.kcal, eaten.kcal),
      protein_g: remaining(target.protein_g, eaten.protein_g ?? 0),
      carbs_g: remaining(target.carbs_g, eaten.carbs_g ?? 0),
      fat_g: remaining(target.fat_g, eaten.fat_g ?? 0),
      fiber_g: remaining(target.fiber_g, eaten.fiber_g ?? 0),
    },
    balance_kcal: caloricBalance(eaten.kcal, settings.baseBurnKcal, exerciseAdj),
    protein_on_target: (eaten.protein_g ?? 0) >= target.protein_g,
  };
}
