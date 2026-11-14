import type { SupabaseClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DB = SupabaseClient<any, "public", any>;

export type Source = "intervals" | "fit" | "manual" | "seed" | "strava" | "apple_health";
export type MealLabel = "pequeno-almoço" | "almoço" | "lanche" | "jantar" | "extra" | "histórico";
export const MEAL_LABELS: MealLabel[] = ["pequeno-almoço", "almoço", "lanche", "jantar", "extra"];

export interface ProfileRow {
  id: string;
  user_id: string;
  name: string;
  age: number | null;
  height_cm: number | null;
  start_weight_kg: number | null;
  start_date: string | null;
  goal_weight_kg: number | null;
  goal_10k_s: number | null;
  goal_hm_s: number | null;
  pb_10k_pace_s: number | null;
  pb_hm_s: number | null;
  easy_pace_min_s: number | null;
  easy_pace_max_s: number | null;
  easy_hr_max: number | null;
  threshold_hr_min: number | null;
  threshold_hr_max: number | null;
  max_hr: number | null;
  base_burn_kcal: number;
  protein_target_g: number;
  fiber_target_g: number;
  rest_base_kcal: number;
  rest_carbs_g: number;
  rest_fat_g: number;
  ratio_ref_kcal: number;
  ratio_carbs_g: number;
  ratio_fat_g: number;
  exercise_factor: number;
  exercise_factor_start: string;
  weekly_template: string[];
}

export interface PhaseRow {
  id: string;
  start_date: string | null;
  end_date: string | null;
  base_kcal: number;
  note: string | null;
}

export interface DayRow {
  id: string;
  date: string;
  weight_kg: number | null;
  weight_source: Source | null;
  steps: number | null;
  steps_source: Source | null;
  resting_hr: number | null;
  hrv: number | null;
  notes: string | null;
  exercise_kcal_raw_override: number | null;
}

export interface SleepRow {
  id: string;
  day_date: string;
  total_min: number | null;
  deep_min: number | null;
  light_min: number | null;
  rem_min: number | null;
  awake_min: number | null;
  score: number | null;
  source: Source;
}

export interface FoodRow {
  id: string;
  name: string;
  serving: string;
  serving_g: number | null;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  is_favorite: boolean;
}

export interface MealItemRow {
  id: string;
  meal_id: string;
  food_id: string | null;
  position: number;
  description: string;
  quantity: number | null;
  unit: string | null;
  kcal: number;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  weight_confirmed: boolean;
  source: string;
  needs_review: boolean;
}

export interface MealRow {
  id: string;
  date: string;
  label: MealLabel;
  eaten_at: string | null;
  photo_path: string | null;
  notes: string | null;
  meal_items?: MealItemRow[];
}

export interface RecipeRow {
  id: string;
  name: string;
  kind: "recipe" | "favorite_meal";
  portions: number;
  default_label: string | null;
  notes: string | null;
  recipe_items?: Array<Omit<MealItemRow, "meal_id" | "weight_confirmed" | "source" | "needs_review"> & { recipe_id: string }>;
}

export interface ActivityRow {
  id: string;
  external_id: string;
  source: Source;
  name: string | null;
  type: string;
  start_time: string | null;
  local_date: string;
  distance_m: number | null;
  duration_s: number | null;
  moving_time_s: number | null;
  avg_hr: number | null;
  max_hr: number | null;
  kcal_raw: number | null;
  ascent_m: number | null;
  descent_m: number | null;
  training_effect: number | null;
  training_load: number | null;
  conditions: string | null;
  feel: string | null;
  fit_path: string | null;
  planned_workout_id: string | null;
  ai_analysis: string | null;
  created_at?: string;
}

export interface LapRow {
  id: string;
  activity_id: string;
  kind: "lap" | "km_split";
  idx: number;
  label: string | null;
  distance_m: number | null;
  duration_s: number | null;
  avg_hr: number | null;
  max_hr: number | null;
  ascent_m: number | null;
  descent_m: number | null;
  bearing_deg: number | null;
}

export interface RaceRow {
  id: string;
  name: string;
  date: string;
  distance_m: number;
  goal_time_s: number | null;
  result_time_s: number | null;
  is_main: boolean;
  notes: string | null;
}

export interface WorkoutStep {
  kind: "aquecimento" | "série" | "recuperação" | "contínuo" | "retorno à calma" | "força" | "nota";
  description: string;
  repeat?: number;
}

export interface PlannedWorkoutRow {
  id: string;
  plan_id: string | null;
  date: string;
  phase: string | null;
  week_index: number | null;
  type: string;
  title: string;
  distance_km: number | null;
  target_pace_min_s: number | null;
  target_pace_max_s: number | null;
  target_hr_min: number | null;
  target_hr_max: number | null;
  structure: WorkoutStep[];
  strength_session_id: string | null;
  status: "planeado" | "feito" | "falhado" | "alterado";
  change_reason: string | null;
}

export interface StrengthSessionRow {
  id: string;
  name: string;
  day_of_week: number | null;
  notes: string | null;
  strength_exercises?: Array<{ id: string; position: number; name: string; zone?: string | null; sets: number | null; reps: string | null; load_range?: string | null; load_kg: number | null; superset: string | null; notes: string | null }>;
}
