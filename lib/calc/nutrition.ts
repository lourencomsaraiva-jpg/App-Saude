import { round1, sum, sumNullable } from "./numbers";

export interface Nutrients {
  kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
}

export const NUTRIENT_KEYS = ["kcal", "protein_g", "carbs_g", "fat_g", "fiber_g"] as const;
export type NutrientKey = (typeof NUTRIENT_KEYS)[number];

/** Soma itens de comida a partir dos valores guardados. kcal desconhecida conta 0; macros desconhecidas ficam null se todas forem desconhecidas. */
export function sumNutrients(items: Nutrients[]): { kcal: number; protein_g: number | null; carbs_g: number | null; fat_g: number | null; fiber_g: number | null } {
  return {
    kcal: sum(items.map((i) => i.kcal)),
    protein_g: sumNullable(items.map((i) => i.protein_g)),
    carbs_g: sumNullable(items.map((i) => i.carbs_g)),
    fat_g: sumNullable(items.map((i) => i.fat_g)),
    fiber_g: sumNullable(items.map((i) => i.fiber_g)),
  };
}

/** Multiplica um item (ex.: 3/5 da dose, ou outro peso). Resultado guardado com 1 casa decimal. */
export function scaleNutrients<T extends Nutrients>(item: T, factor: number): T {
  const out = { ...item };
  for (const k of NUTRIENT_KEYS) {
    const v = item[k];
    out[k] = (v === null || v === undefined ? null : round1(v * factor)) as T[typeof k];
  }
  return out;
}

export interface KcalCheck {
  ok: boolean;
  expectedKcal: number;
  diffPct: number;
}

/**
 * Validação automática das estimativas: kcal ≈ 4×prot + 4×hidr + 9×gord, tolerância 10 %.
 * Se falhar, a linha fica marcada "a rever".
 */
export function checkKcalConsistency(n: Nutrients, tolerance = 0.1): KcalCheck {
  const expected = round1(4 * (n.protein_g ?? 0) + 4 * (n.carbs_g ?? 0) + 9 * (n.fat_g ?? 0));
  const kcal = n.kcal ?? 0;
  if (expected === 0 && kcal === 0) return { ok: true, expectedKcal: 0, diffPct: 0 };
  // Itens muito pequenos (< 20 kcal): aceitar até 5 kcal de diferença absoluta.
  if (Math.abs(kcal - expected) <= 5 && Math.max(kcal, expected) < 20) return { ok: true, expectedKcal: expected, diffPct: 0 };
  const ref = Math.max(expected, 1);
  const diffPct = round1((Math.abs(kcal - expected) / ref) * 100);
  return { ok: diffPct <= tolerance * 100, expectedKcal: expected, diffPct };
}

export interface RecipeLike extends Nutrients {
  portions: number;
}

/** Total de uma receita e valor por porção. */
export function recipeTotals(items: Nutrients[], portions: number) {
  const total = sumNutrients(items);
  const p = portions > 0 ? portions : 1;
  const perPortion = {
    kcal: round1(total.kcal / p),
    protein_g: total.protein_g === null ? null : round1(total.protein_g / p),
    carbs_g: total.carbs_g === null ? null : round1(total.carbs_g / p),
    fat_g: total.fat_g === null ? null : round1(total.fat_g / p),
    fiber_g: total.fiber_g === null ? null : round1(total.fiber_g / p),
  };
  return { total, perPortion };
}
