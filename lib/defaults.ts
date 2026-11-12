/**
 * Valores iniciais (secções 3 e 7 da spec). São copiados para a base de dados na primeira
 * entrada e depois editáveis em Definições — a app lê sempre da base de dados.
 */
import type { CaloriePhase } from "./calc/energy";

export const DEFAULT_PROFILE = {
  name: "",
  age: 39,
  height_cm: 180,
  start_weight_kg: 82.6,
  start_date: "2026-07-30",
  goal_weight_kg: null as number | null,
  goal_10k_s: 40 * 60,
  goal_hm_s: 90 * 60,
  pb_10k_pace_s: 4 * 60 + 14,
  pb_hm_s: 1 * 3600 + 36 * 60 + 24,
  easy_pace_min_s: 5 * 60 + 30,
  easy_pace_max_s: 5 * 60 + 55,
  easy_hr_max: 150,
  threshold_hr_min: 162,
  threshold_hr_max: 175,
  max_hr: 185,
  base_burn_kcal: 2417,
  protein_target_g: 155,
  fiber_target_g: 30,
  rest_base_kcal: 2050,
  rest_carbs_g: 250,
  rest_fat_g: 48,
  ratio_ref_kcal: 2747,
  ratio_carbs_g: 385,
  ratio_fat_g: 65,
  exercise_factor: 0.95,
  exercise_factor_start: "2026-10-12",
  weekly_template: ["descanso", "qualidade", "força", "fácil", "força", "fácil", "longo"],
};

export const DEFAULT_PHASES: Array<CaloriePhase & { note: string }> = [
  { start_date: null, end_date: "2026-11-15", base_kcal: 2050, note: "Défice ~−367/dia" },
  { start_date: "2026-11-07", end_date: "2026-11-07", base_kcal: 2250, note: "Véspera de teste longo (exceção de um dia)" },
  { start_date: "2026-11-16", end_date: "2026-11-24", base_kcal: 2250, note: "Afinamento, défice pequeno" },
  { start_date: "2026-11-25", end_date: "2026-11-28", base_kcal: 2417, note: "Manutenção + carga de hidratos (conta com +1 a 1,5 kg de água)" },
  { start_date: "2026-11-29", end_date: null, base_kcal: 2050, note: "Retoma o défice" },
];

export interface FoodSeed {
  name: string;
  serving: string;
  serving_g: number | null;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  favorite?: boolean;
}

export const DEFAULT_FOODS: FoodSeed[] = [
  { name: "Peito de frango grelhado", serving: "100 g", serving_g: 100, kcal: 165, protein_g: 31, carbs_g: 0, fat_g: 3.6, fiber_g: 0, favorite: true },
  { name: "Arroz branco cozido", serving: "200 g", serving_g: 200, kcal: 260, protein_g: 5, carbs_g: 57, fat_g: 0.8, fiber_g: 0.8, favorite: true },
  { name: "Feijão cozido", serving: "100 g", serving_g: 100, kcal: 127, protein_g: 8.7, carbs_g: 22.8, fat_g: 0.5, fiber_g: 6.4, favorite: true },
  { name: "Brócolos", serving: "75 g", serving_g: 75, kcal: 26, protein_g: 1.8, carbs_g: 5.2, fat_g: 0.3, fiber_g: 2.5 },
  { name: "Sopa de legumes", serving: "300 ml", serving_g: 300, kcal: 110, protein_g: 3, carbs_g: 15, fat_g: 4, fiber_g: 2, favorite: true },
  { name: "Iogurte proteína Auchan", serving: "1 un.", serving_g: null, kcal: 212, protein_g: 30, carbs_g: 18.8, fat_g: 2, fiber_g: 0, favorite: true },
  { name: "Iogurte proteína Continente", serving: "1 un.", serving_g: null, kcal: 138.5, protein_g: 20, carbs_g: 11, fat_g: 1.2, fiber_g: 0, favorite: true },
  { name: "Manteiga de amendoim", serving: "30 g", serving_g: 30, kcal: 180, protein_g: 7.5, carbs_g: 6, fat_g: 15, fiber_g: 2, favorite: true },
  { name: "Cacetinho branco", serving: "100 g", serving_g: 100, kcal: 264, protein_g: 9, carbs_g: 50, fat_g: 1.5, fiber_g: 2.5, favorite: true },
  { name: "Cacetinho integral", serving: "100 g", serving_g: 100, kcal: 250, protein_g: 10, carbs_g: 45, fat_g: 2.5, fiber_g: 5 },
  { name: "Banana", serving: "120 g", serving_g: 120, kcal: 105, protein_g: 1.3, carbs_g: 27, fat_g: 0.4, fiber_g: 3, favorite: true },
  { name: "Fiambre de peru/frango", serving: "2 fatias (40 g)", serving_g: 40, kcal: 44, protein_g: 7.6, carbs_g: 1, fat_g: 1, fiber_g: 0 },
  { name: "Whey", serving: "1 scoop", serving_g: null, kcal: 118, protein_g: 24.5, carbs_g: 2, fat_g: 1.5, fiber_g: 0, favorite: true },
  { name: "Isostar", serving: "1 scoop", serving_g: null, kcal: 74, protein_g: 0, carbs_g: 18, fat_g: 0, fiber_g: 0 },
  { name: "Gel Prozis", serving: "1 un.", serving_g: null, kcal: 90, protein_g: 0, carbs_g: 22, fat_g: 0, fiber_g: 0 },
  { name: "Mini Kit Kat", serving: "1 un.", serving_g: null, kcal: 60, protein_g: 0.8, carbs_g: 7.3, fat_g: 3, fiber_g: 0.2 },
  { name: "Batatas fritas", serving: "50 g", serving_g: 50, kcal: 156, protein_g: 1.8, carbs_g: 16, fat_g: 7.8, fiber_g: 1.5 },
  { name: "Fatia de pizza margherita", serving: "110 g", serving_g: 110, kcal: 280, protein_g: 12, carbs_g: 36, fat_g: 10, fiber_g: 2 },
];
// Nota: o iogurte Continente tem 1,15 g de gordura na tabela da spec; guarda-se com 1 casa decimal (1,2).

/** Refeições favoritas: nome → [alimento, multiplicador da dose]. */
export const DEFAULT_FAVORITE_MEALS: Array<{ name: string; label: string; items: Array<[string, number, string]> }> = [
  {
    name: "Pequeno-almoço habitual",
    label: "pequeno-almoço",
    items: [
      ["Cacetinho branco", 1, "2 torradas de cacetinho (100 g)"],
      ["Manteiga de amendoim", 1, "Manteiga de amendoim 30 g"],
      ["Iogurte proteína Auchan", 1, "Iogurte proteína Auchan"],
    ],
  },
  {
    name: "Arroz, feijão e frango",
    label: "almoço",
    items: [
      ["Arroz branco cozido", 1, "Arroz branco cozido 200 g"],
      ["Feijão cozido", 1.5, "Feijão cozido 150 g"],
      ["Peito de frango grelhado", 1, "Peito de frango grelhado 100 g"],
    ],
  },
];

export const DEFAULT_RACES = [
  { name: "Corrida do Tejo 10 km", date: "2026-09-13", distance_m: 10000, goal_time_s: null, result_time_s: 44 * 60 + 10, is_main: false },
  { name: "Meia Maratona dos Descobrimentos", date: "2026-11-28", distance_m: 21097, goal_time_s: 90 * 60, result_time_s: null, is_main: true },
  { name: "GP de Natal Benfica 10 km", date: "2026-12-20", distance_m: 10000, goal_time_s: 40 * 60, result_time_s: null, is_main: false },
];

export interface StrengthExerciseSeed {
  name: string;
  sets: number;
  reps: string;
  load_kg: number | null;
  superset: string | null;
  notes: string;
}

export const DEFAULT_STRENGTH: Array<{ name: string; day_of_week: number; notes: string; exercises: StrengthExerciseSeed[] }> = [
  {
    name: "Força A — pernas e core",
    day_of_week: 2,
    notes: "Halteres ajustáveis 2–24 kg. Descanso 60–90 s entre supersets. Na semana da prova: só 2 séries, sem falha.",
    exercises: [
      { name: "Agachamento goblet", sets: 3, reps: "10", load_kg: 20, superset: "A", notes: "Peito alto, joelhos na linha dos pés." },
      { name: "Gémeos em pé (unilateral)", sets: 3, reps: "15", load_kg: 16, superset: "A", notes: "Pausa de 1 s em cima." },
      { name: "Peso morto romeno com halteres", sets: 3, reps: "10", load_kg: 2 * 18, superset: "B", notes: "Anca para trás, costas neutras. Carga = 2 halteres." },
      { name: "Prancha", sets: 3, reps: "40 s", load_kg: null, superset: "B", notes: "Glúteos contraídos." },
      { name: "Afundo búlgaro", sets: 3, reps: "8 por perna", load_kg: 2 * 10, superset: "C", notes: "Tronco ligeiramente inclinado." },
      { name: "Dead bug", sets: 3, reps: "10", load_kg: null, superset: "C", notes: "Lombar colada ao chão." },
    ],
  },
  {
    name: "Força B — cadeia posterior, tronco e estabilidade",
    day_of_week: 4,
    notes: "Halteres ajustáveis 2–24 kg. Evitar falha muscular na véspera do longo.",
    exercises: [
      { name: "Step-up para banco", sets: 3, reps: "8 por perna", load_kg: 2 * 12, superset: "A", notes: "Empurrar com o pé de cima." },
      { name: "Remada unilateral", sets: 3, reps: "10 por braço", load_kg: 22, superset: "A", notes: "Cotovelo junto ao corpo." },
      { name: "Hip thrust com halter", sets: 3, reps: "12", load_kg: 24, superset: "B", notes: "Pausa de 1 s em cima." },
      { name: "Flexões", sets: 3, reps: "12", load_kg: null, superset: "B", notes: "Corpo em linha." },
      { name: "Ponte lateral (Copenhaga curta)", sets: 3, reps: "20 s por lado", load_kg: null, superset: "C", notes: "Adutores e estabilidade da anca." },
      { name: "Elevação de pé em equilíbrio", sets: 3, reps: "30 s por pé", load_kg: null, superset: "C", notes: "Propriocepção do tornozelo." },
    ],
  },
];
