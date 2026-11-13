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
  // ——— acrescentados a partir do histórico (valores usados nas notas de 30/07 a 12/11) ———
  { name: "Torradas de pão branco", serving: "2 fatias (~80 g)", serving_g: 80, kcal: 211, protein_g: 7.2, carbs_g: 40, fat_g: 1.2, fiber_g: 1.6, favorite: true },
  { name: "Torradas de pão escuro", serving: "2 fatias (~60 g)", serving_g: 60, kcal: 150, protein_g: 6, carbs_g: 27, fat_g: 2, fiber_g: 4, favorite: true },
  { name: "Pão bola de água", serving: "1 un. (~90 g)", serving_g: 90, kcal: 238, protein_g: 8, carbs_g: 45, fat_g: 1.4, fiber_g: 1.8, favorite: true },
  { name: "Pão de sementes", serving: "~90 g", serving_g: 90, kcal: 243, protein_g: 9, carbs_g: 36, fat_g: 6, fiber_g: 4.5, favorite: true },
  { name: "Queijo (fatia)", serving: "1 fatia (~20 g)", serving_g: 20, kcal: 70, protein_g: 5, carbs_g: 0.3, fat_g: 5.5, fiber_g: 0, favorite: true },
  { name: "Gelatina de proteína Lidl", serving: "1 un.", serving_g: null, kcal: 40, protein_g: 10, carbs_g: 0, fat_g: 0, fiber_g: 0, favorite: true },
  { name: "Iogurte natural", serving: "1 un. (125 g)", serving_g: 125, kcal: 64, protein_g: 4.5, carbs_g: 5.5, fat_g: 3, fiber_g: 0, favorite: true },
  { name: "Iogurte líquido", serving: "~200 g", serving_g: 200, kcal: 130, protein_g: 6, carbs_g: 20.5, fat_g: 2.5, fiber_g: 0, favorite: true },
  { name: "Leite magro", serving: "250 ml", serving_g: 250, kcal: 85, protein_g: 8.5, carbs_g: 12.5, fat_g: 0.3, fiber_g: 0, favorite: true },
  { name: "Ovos mexidos", serving: "1 ovo (c/ gordura)", serving_g: null, kcal: 90, protein_g: 6.3, carbs_g: 0.5, fat_g: 6.5, fiber_g: 0, favorite: true },
  { name: "Grão-de-bico cozido", serving: "100 g", serving_g: 100, kcal: 131, protein_g: 7.1, carbs_g: 21.6, fat_g: 2.1, fiber_g: 6, favorite: true },
  { name: "Feijão manteiga cozido", serving: "100 g", serving_g: 100, kcal: 110, protein_g: 7, carbs_g: 19, fat_g: 0.5, fiber_g: 6, favorite: true },
  { name: "Bifes de peru grelhados", serving: "100 g", serving_g: 100, kcal: 122, protein_g: 23.9, carbs_g: 0, fat_g: 2.8, fiber_g: 0, favorite: true },
  { name: "Hambúrguer de vaca", serving: "~100 g", serving_g: 100, kcal: 210, protein_g: 20, carbs_g: 0, fat_g: 14, fiber_g: 0, favorite: true },
  { name: "Hambúrguer de feijão caseiro", serving: "1 un. (~100 g)", serving_g: 100, kcal: 180, protein_g: 7, carbs_g: 22, fat_g: 6, fiber_g: 6, favorite: true },
  { name: "Lasanha de carne c/ béchamel", serving: "200 g", serving_g: 200, kcal: 340, protein_g: 20, carbs_g: 28, fat_g: 17, fiber_g: 1.5, favorite: true },
  { name: "Bacalhau com natas", serving: "~235 g", serving_g: 235, kcal: 485, protein_g: 26.5, carbs_g: 27.5, fat_g: 29, fiber_g: 0, favorite: true },
  { name: "Legumes cozidos", serving: "150 g (sem azeite)", serving_g: 150, kcal: 45, protein_g: 3, carbs_g: 7.5, fat_g: 0.5, fiber_g: 3.8, favorite: true },
  { name: "Esparregado", serving: "~120 g", serving_g: 120, kcal: 115, protein_g: 4, carbs_g: 9, fat_g: 7, fiber_g: 0, favorite: true },
  { name: "Salada mista", serving: "1 porção", serving_g: null, kcal: 52, protein_g: 1.5, carbs_g: 9, fat_g: 2.5, fiber_g: 2, favorite: true },
  { name: "Tomate cherry", serving: "7 un. (~80 g)", serving_g: 80, kcal: 15, protein_g: 1, carbs_g: 3, fat_g: 0, fiber_g: 1, favorite: true },
  { name: "Milho doce", serving: "~35 g", serving_g: 35, kcal: 30, protein_g: 1, carbs_g: 6.5, fat_g: 0.4, fiber_g: 1, favorite: true },
  { name: "Batata doce", serving: "100 g", serving_g: 100, kcal: 90, protein_g: 1.6, carbs_g: 20.7, fat_g: 0.2, fiber_g: 3.3, favorite: true },
  { name: "Azeite", serving: "5 g (1 colher de chá)", serving_g: 5, kcal: 45, protein_g: 0, carbs_g: 0, fat_g: 5, fiber_g: 0, favorite: true },
  { name: "Meloa", serving: "100 g", serving_g: 100, kcal: 34, protein_g: 0.8, carbs_g: 8, fat_g: 0.2, fiber_g: 0.9, favorite: true },
  { name: "Ananás", serving: "~150 g", serving_g: 150, kcal: 75, protein_g: 0.8, carbs_g: 19, fat_g: 0.2, fiber_g: 2, favorite: true },
  { name: "Sumo de laranja natural", serving: "250 ml", serving_g: 250, kcal: 112, protein_g: 1.8, carbs_g: 26, fat_g: 0.5, fiber_g: 0.5, favorite: true },
  { name: "Go Active Pingo Doce", serving: "1 un. (120 g)", serving_g: 120, kcal: 90, protein_g: 4.8, carbs_g: 16, fat_g: 0.4, fiber_g: 2.5, favorite: true },
  { name: "Barra proteica Billion Prozis", serving: "1 un. (65 g)", serving_g: null, kcal: 310, protein_g: 17, carbs_g: 27, fat_g: 15, fiber_g: 2, favorite: true },
  { name: "Gelado Snickers", serving: "1 barra", serving_g: null, kcal: 180, protein_g: 3.4, carbs_g: 17, fat_g: 11.2, fiber_g: 0, favorite: true },
  { name: "Gelado Mars", serving: "1 barra", serving_g: null, kcal: 125, protein_g: 1.7, carbs_g: 13.7, fat_g: 6.9, fiber_g: 0, favorite: true },
  { name: "Aquarius isotónica", serving: "1 un.", serving_g: null, kcal: 49, protein_g: 0, carbs_g: 12, fat_g: 0, fiber_g: 0, favorite: true },
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
  { name: "Meia Maratona de Lisboa (Hyundai Half)", date: "2026-10-11", distance_m: 21097, goal_time_s: null, result_time_s: 1 * 3600 + 36 * 60 + 24, is_main: false },
  { name: "Meia Maratona dos Descobrimentos", date: "2026-11-28", distance_m: 21097, goal_time_s: 90 * 60, result_time_s: null, is_main: true },
  { name: "GP de Natal Benfica 10 km", date: "2026-12-20", distance_m: 10000, goal_time_s: 40 * 60, result_time_s: null, is_main: false },
];

export interface StrengthExerciseSeed {
  name: string;
  zone: string;
  sets: number;
  reps: string;
  load_range: string;
  superset: string;
  notes: string;
}

const STRENGTH_GENERAL =
  "Halteres ajustáveis JUPPLIES 2–24 kg (15 níveis: sobe 1,5–2 kg de cada vez). Superset: 3 voltas por bloco, 60–75 s de descanso depois do par. Aquece 5 min (marcha rápida, mobilidade de anca). Mantém a carga 2–3 semanas até as reps ficarem fáceis e só depois sobes. Dor articular (≠ fadiga muscular): para o exercício.";

/** Plano de força do atleta ("Força para Corredores"). day_of_week: 0 = segunda. */
export const DEFAULT_STRENGTH: Array<{ name: string; day_of_week: number; notes: string; exercises: StrengthExerciseSeed[] }> = [
  {
    name: "Pernas + Peito (~25 min)",
    day_of_week: 2,
    notes: STRENGTH_GENERAL,
    exercises: [
      { superset: "A1", zone: "Quadríceps/Glúteos", name: "Agachamento búlgaro", sets: 3, reps: "8-10/perna", load_range: "6-10 kg", notes: "Pé de trás elevado num banco/cadeira; desce até a coxa da frente ficar paralela ao chão." },
      { superset: "A2", zone: "Peito", name: "Flexões (push-ups)", sets: 3, reps: "10-15", load_range: "peso do corpo", notes: "Mãos ligeiramente mais largas que os ombros, corpo reto. Joelhos no chão se precisares de reduzir dificuldade." },
      { superset: "B1", zone: "Cadeia posterior", name: "Peso morto romeno unilateral", sets: 3, reps: "8/perna", load_range: "8-12 kg", notes: "Perna de apoio ligeiramente fletida, tronco reto. Sente o alongamento no isquiotibial." },
      { superset: "B2", zone: "Peito", name: "Supino no chão (floor press)", sets: 3, reps: "10-12", load_range: "8-12 kg", notes: "Deitado de costas, joelhos fletidos. Halteres sobem em linha reta acima do peito, cotovelos param no chão." },
      { superset: "C1", zone: "Cadeia posterior", name: "Ponte de glúteos com carga", sets: 3, reps: "12-15", load_range: "10-16 kg", notes: "Haltere apoiado sobre a bacia. Aperta os glúteos no topo 1-2 s." },
      { superset: "C2", zone: "Core", name: "Prancha frontal", sets: 3, reps: "30-45 s", load_range: "peso do corpo", notes: "Cotovelos sob os ombros, corpo reto da cabeça aos calcanhares." },
    ],
  },
  {
    name: "Estabilidade + Braços (~25 min)",
    day_of_week: 4,
    notes: STRENGTH_GENERAL + " Peito e braços são acessórios — volume baixo de propósito para não comprometer a recuperação das pernas.",
    exercises: [
      { superset: "A1", zone: "Quadríceps/Glúteos", name: "Afundo lateral", sets: 3, reps: "8-10/perna", load_range: "6-10 kg", notes: "Passo largo para o lado, senta na anca do lado que se move, perna oposta fica esticada." },
      { superset: "A2", zone: "Braços", name: "Rosca bíceps", sets: 3, reps: "10-12", load_range: "6-10 kg", notes: "Cotovelos fixos junto ao corpo, sobe controlado sem balançar o tronco." },
      { superset: "B1", zone: "Quadríceps/Glúteos", name: "Step-down excêntrico", sets: 3, reps: "8/perna", load_range: "4-8 kg", notes: "Em cima de um step, desce devagar (3-4 s) sem deixar o joelho cair para dentro." },
      { superset: "B2", zone: "Braços", name: "Tríceps francês (overhead)", sets: 3, reps: "10-12", load_range: "6-10 kg", notes: "Um haltere com as duas mãos atrás da cabeça, cotovelos apontam para cima e ficam fixos, estende os braços." },
      { superset: "C1", zone: "Core", name: "Prancha lateral", sets: 3, reps: "25-35 s/lado", load_range: "peso do corpo", notes: "Cotovelo sob o ombro, corpo em linha reta." },
      { superset: "C2", zone: "Gémeos/Estabilidade", name: "Elevação de gémeos unipodal", sets: 3, reps: "10-12/perna", load_range: "4-8 kg", notes: "Um haltere na mão do mesmo lado da perna de apoio. Sobe controlado, sem balançar." },
    ],
  },
  {
    name: "Opcional — Core & Mobilidade (~15 min, sem halteres)",
    day_of_week: 0,
    notes: "Segunda-feira em semanas com boa energia, ou substituto leve se faltares a quarta/sexta.",
    exercises: [
      { superset: "1", zone: "Core", name: "Prancha frontal", sets: 3, reps: "30-40 s", load_range: "peso do corpo", notes: "Igual à de quarta — mantém como referência de progressão." },
      { superset: "2", zone: "Core", name: "Bird-dog", sets: 3, reps: "8/lado", load_range: "peso do corpo", notes: "De gatas, estende braço e perna opostos em simultâneo, bacia estável." },
      { superset: "3", zone: "Core", name: "Dead bug", sets: 3, reps: "10/lado", load_range: "peso do corpo", notes: "Deitado de costas, baixa braço e perna opostos até quase tocar no chão, lombar sempre no chão." },
      { superset: "4", zone: "Mobilidade", name: "Mobilidade de anca (90/90)", sets: 2, reps: "8/lado", load_range: "peso do corpo", notes: "Sentado, roda entre as duas posições de anca — melhora amplitude de passada." },
    ],
  },
];
