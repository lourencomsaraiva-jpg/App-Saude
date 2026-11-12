/** Exportação CSV (vírgula) e "Excel" (CSV com ; e vírgula decimal + BOM, abre direto no Excel em pt-PT). */
import { formatPace } from "./calc/running";
import type { DayView } from "./data/days";

const HEADERS = [
  "data", "peso_kg", "kcal_comidas", "gasto_base", "exercicio_bruto", "exercicio_ajustado", "base_fase", "alvo_kcal", "saldo",
  "proteina_g", "hidratos_g", "gordura_g", "fibra_g", "alvo_proteina_g", "alvo_hidratos_g", "alvo_gordura_g", "alvo_fibra_g",
  "falta_kcal", "falta_proteina_g", "passos", "fc_repouso", "vfc", "sono_total_min", "sono_profundo_min", "sono_leve_min", "sono_rem_min", "sono_acordado_min",
  "corrida_km", "corrida_ritmo", "corrida_fc", "notas",
];

export function daysToRows(days: DayView[]): Array<Array<string | number | null>> {
  return days.map((d) => {
    const s = d.summary;
    return [
      d.date, d.weight_kg, d.has_food ? s.eaten.kcal : null, s.base_burn_kcal, s.exercise_kcal_raw, s.exercise_kcal_adj, s.phase_base_kcal, s.target.kcal, d.has_food ? s.balance_kcal : null,
      s.eaten.protein_g, s.eaten.carbs_g, s.eaten.fat_g, s.eaten.fiber_g, s.target.protein_g, s.target.carbs_g, s.target.fat_g, s.target.fiber_g,
      s.remaining.kcal, s.remaining.protein_g, d.steps, d.resting_hr, d.hrv,
      d.sleep?.total_min ?? null, d.sleep?.deep_min ?? null, d.sleep?.light_min ?? null, d.sleep?.rem_min ?? null, d.sleep?.awake_min ?? null,
      d.run_distance_km, d.run_pace ? formatPace(d.run_pace) : null, d.run_avg_hr, d.notes,
    ];
  });
}

export function toCsv(rows: Array<Array<string | number | null>>, excel = false): string {
  const sep = excel ? ";" : ",";
  const cell = (v: string | number | null) => {
    if (v === null || v === undefined) return "";
    let s = typeof v === "number" ? (excel ? String(v).replace(".", ",") : String(v)) : v;
    if (/[",;\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const body = [HEADERS, ...rows].map((r) => r.map((c) => cell(c as string | number | null)).join(sep)).join("\r\n");
  return excel ? `﻿${body}` : body;
}
