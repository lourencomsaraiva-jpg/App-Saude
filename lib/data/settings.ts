import type { CaloriePhase, EnergySettings } from "../calc/energy";
import { DEFAULT_ENERGY_SETTINGS } from "../calc/energy";
import type { DB, PhaseRow, ProfileRow } from "../types";

export function energySettingsFromProfile(p: ProfileRow | null): EnergySettings {
  if (!p) return DEFAULT_ENERGY_SETTINGS;
  const n = (v: unknown, d: number) => (v === null || v === undefined ? d : Number(v));
  return {
    baseBurnKcal: n(p.base_burn_kcal, DEFAULT_ENERGY_SETTINGS.baseBurnKcal),
    exerciseFactor: n(p.exercise_factor, DEFAULT_ENERGY_SETTINGS.exerciseFactor),
    exerciseFactorStart: p.exercise_factor_start ?? DEFAULT_ENERGY_SETTINGS.exerciseFactorStart,
    proteinTargetG: n(p.protein_target_g, DEFAULT_ENERGY_SETTINGS.proteinTargetG),
    fiberTargetG: n(p.fiber_target_g, DEFAULT_ENERGY_SETTINGS.fiberTargetG),
    restBaseKcal: n(p.rest_base_kcal, DEFAULT_ENERGY_SETTINGS.restBaseKcal),
    restCarbsG: n(p.rest_carbs_g, DEFAULT_ENERGY_SETTINGS.restCarbsG),
    restFatG: n(p.rest_fat_g, DEFAULT_ENERGY_SETTINGS.restFatG),
    ratioRefKcal: n(p.ratio_ref_kcal, DEFAULT_ENERGY_SETTINGS.ratioRefKcal),
    ratioCarbsG: n(p.ratio_carbs_g, DEFAULT_ENERGY_SETTINGS.ratioCarbsG),
    ratioFatG: n(p.ratio_fat_g, DEFAULT_ENERGY_SETTINGS.ratioFatG),
    defaultPhaseBaseKcal: n(p.rest_base_kcal, DEFAULT_ENERGY_SETTINGS.defaultPhaseBaseKcal),
  };
}

export interface Settings {
  profile: ProfileRow | null;
  energy: EnergySettings;
  phases: Array<CaloriePhase & { id: string; note: string | null }>;
}

/** Postgres devolve numeric como string; normalizar para número. */
export function num<T extends Record<string, unknown>>(row: T, keys: string[]): T {
  const out: Record<string, unknown> = { ...row };
  for (const k of keys) if (out[k] !== null && out[k] !== undefined) out[k] = Number(out[k]);
  return out as T;
}

export async function loadSettings(db: DB, userId?: string): Promise<Settings> {
  let pq = db.from("profile").select("*");
  let fq = db.from("calorie_phases").select("*");
  if (userId) {
    pq = pq.eq("user_id", userId);
    fq = fq.eq("user_id", userId);
  }
  const [{ data: profile }, { data: phases }] = await Promise.all([pq.maybeSingle(), fq.order("start_date", { ascending: true, nullsFirst: true })]);
  const p = profile as ProfileRow | null;
  return {
    profile: p,
    energy: energySettingsFromProfile(p),
    phases: ((phases ?? []) as PhaseRow[]).map((r) => ({ ...r, base_kcal: Number(r.base_kcal) })),
  };
}
