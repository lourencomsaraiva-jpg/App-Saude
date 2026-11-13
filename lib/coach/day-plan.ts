/**
 * "Até ao fim do dia": plano concreto de refeições (a partir da tabela pessoal de alimentos) para fechar
 * os alvos, e o que falta fazer de treino. Função pura, sem IA.
 */
import { fmt, round1 } from "../calc/numbers";
import { normalize } from "../food/local-match";

export interface PlanFood {
  name: string;
  serving: string;
  serving_g: number | null;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
}

export interface Remaining {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
}

interface Portion {
  food: PlanFood;
  mult: number; // múltiplos da dose
}

interface Meal {
  label: string;
  portions: Portion[];
}

const find = (foods: PlanFood[], ...names: string[]) => {
  for (const n of names) {
    const f = foods.find((x) => normalize(x.name).includes(normalize(n)));
    if (f) return f;
  }
  return null;
};

const totals = (ps: Portion[]) =>
  ps.reduce(
    (t, p) => ({
      kcal: t.kcal + p.food.kcal * p.mult,
      protein_g: t.protein_g + p.food.protein_g * p.mult,
      carbs_g: t.carbs_g + p.food.carbs_g * p.mult,
      fat_g: t.fat_g + p.food.fat_g * p.mult,
      fiber_g: t.fiber_g + p.food.fiber_g * p.mult,
    }),
    { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 },
  );

/** Arredonda a dose: alimentos por gramas em passos de 50 g; por unidade em 1 un. */
function roundMult(f: PlanFood, mult: number, min = 0.5, max = 3): number {
  if (mult <= 0) return 0;
  if (f.serving_g) {
    const g = Math.round((mult * f.serving_g) / 50) * 50;
    return Math.min(Math.max(g, min * f.serving_g), max * f.serving_g) / f.serving_g;
  }
  return Math.min(Math.max(Math.round(mult), 1), Math.ceil(max));
}

export function portionText(p: Portion): string {
  const f = p.food;
  if (f.serving_g) {
    const unit = /ml/.test(f.serving) ? "ml" : "g";
    return `${fmt(Math.round(f.serving_g * p.mult))} ${unit} de ${f.name.toLowerCase()}`;
  }
  return `${p.mult === 1 ? "1" : fmt(p.mult)} × ${f.name}`;
}

function mainMeal(label: string, foods: PlanFood[], budget: Remaining): Meal | null {
  const protein = find(foods, "peito de frango", "bifes de peru", "frango");
  const carb = find(foods, "arroz branco cozido", "batata doce", "cacetinho");
  const veg = budget.fiber_g > 4 ? find(foods, "sopa de legumes", "legumes cozidos", "brocolos") : null;
  const ps: Portion[] = [];
  const left = () => {
    const t = totals(ps);
    return { kcal: budget.kcal - t.kcal, protein_g: budget.protein_g - t.protein_g, carbs_g: budget.carbs_g - t.carbs_g, fat_g: budget.fat_g - t.fat_g, fiber_g: budget.fiber_g - t.fiber_g };
  };
  if (protein && budget.protein_g > 10) ps.push({ food: protein, mult: roundMult(protein, (budget.protein_g * 0.85) / protein.protein_g, 1, 2.5) });
  if (veg) ps.push({ food: veg, mult: 1 });
  // fibra: leguminosas (também contam como hidratos)
  const legume = left().fiber_g > 6 ? find(foods, "feijao cozido", "grao-de-bico", "feijao manteiga") : null;
  if (legume) ps.push({ food: legume, mult: 1 });
  // hidratos: arroz (máx. 250 g), o resto em fruta
  if (carb) {
    const l = left();
    const m = Math.min(l.carbs_g / Math.max(carb.carbs_g, 1), l.kcal / Math.max(carb.kcal, 1), carb.serving_g ? 250 / carb.serving_g : 2);
    if (m >= 0.25) ps.push({ food: carb, mult: roundMult(carb, m, 0.25, carb.serving_g ? 250 / carb.serving_g : 2) });
  }
  // gordura em falta: azeite (5 g por dose, máx. 10 g)
  const oil = left().fat_g > 7 && left().kcal > 90 ? find(foods, "azeite") : null;
  if (oil) ps.push({ food: oil, mult: Math.min(2, Math.floor(left().fat_g / oil.fat_g)) });
  const fruit = left().carbs_g > 25 && left().kcal > 110 ? find(foods, "banana") : null;
  if (fruit) ps.push({ food: fruit, mult: 1 });
  // não ultrapassar o orçamento em mais de 10 %: tira a fruta, depois reduz o arroz
  if (fruit && totals(ps).kcal > budget.kcal * 1.1) ps.splice(ps.findIndex((p) => p.food === fruit), 1);
  const c = ps.find((p) => p.food === carb);
  while (c && totals(ps).kcal > budget.kcal * 1.1 && c.mult > 0.25) c.mult = roundMult(c.food, c.mult - (c.food.serving_g ? 50 / c.food.serving_g : 1), 0.25, 2);
  return ps.length ? { label, portions: ps.filter((p) => p.mult > 0) } : null;
}

function snackMeal(label: string, foods: PlanFood[], budget: Remaining): Meal | null {
  const yog = find(foods, "iogurte proteina continente", "iogurte proteina auchan", "iogurte de proteina");
  const fruit = budget.carbs_g > 20 ? find(foods, "banana") : null;
  const ps: Portion[] = [];
  if (yog && budget.protein_g > 10) ps.push({ food: yog, mult: 1 });
  if (fruit && totals(ps).kcal + fruit.kcal <= budget.kcal + 30) ps.push({ food: fruit, mult: 1 });
  return ps.length ? { label, portions: ps } : null;
}

function lightMeal(label: string, foods: PlanFood[], budget: Remaining): Meal | null {
  const options = [find(foods, "iogurte proteina continente"), find(foods, "whey"), find(foods, "gelatina de proteina")].filter((x): x is PlanFood => !!x);
  const fit = options.filter((o) => o.kcal <= Math.max(budget.kcal, 45)).sort((a, b) => b.protein_g - a.protein_g)[0];
  return fit && budget.protein_g > 8 ? { label, portions: [{ food: fit, mult: 1 }] } : null;
}

/** Plano de refeições para o resto do dia, conforme a hora. */
export function planMeals(hour: number, rem: Remaining, foods: PlanFood[]): { meals: Meal[]; after: Remaining } {
  const meals: Meal[] = [];
  let left: Remaining = { ...rem };
  const take = (m: Meal | null) => {
    if (!m) return;
    meals.push(m);
    const t = totals(m.portions);
    left = { kcal: left.kcal - t.kcal, protein_g: left.protein_g - t.protein_g, carbs_g: left.carbs_g - t.carbs_g, fat_g: left.fat_g - t.fat_g, fiber_g: left.fiber_g - t.fiber_g };
  };
  if (rem.kcal < 60) {
    take(rem.protein_g > 15 ? lightMeal("Se tiveres fome", foods, rem) : null);
  } else if (hour < 11) {
    take(mainMeal("Almoço", foods, { ...rem, kcal: rem.kcal * 0.45, protein_g: rem.protein_g * 0.4, carbs_g: rem.carbs_g * 0.45, fiber_g: rem.fiber_g * 0.5 }));
    take(snackMeal("Lanche", foods, { ...left, kcal: rem.kcal * 0.2 }));
    take(mainMeal("Jantar", foods, left));
  } else if (hour < 16) {
    take(snackMeal("Lanche", foods, { ...rem, kcal: rem.kcal * 0.3 }));
    take(mainMeal("Jantar", foods, left));
  } else if (hour < 21) {
    take(mainMeal("Jantar", foods, rem));
  } else {
    take(lightMeal("Ceia leve", foods, rem));
  }
  const r = (x: number) => round1(x);
  return { meals, after: { kcal: r(left.kcal), protein_g: r(left.protein_g), carbs_g: r(left.carbs_g), fat_g: r(left.fat_g), fiber_g: r(left.fiber_g) } };
}

export function mealLine(m: Meal): string {
  const t = totals(m.portions);
  return `${m.label}: ${m.portions.map(portionText).join(" + ")} → ≈${fmt(t.kcal)} kcal · ${fmt(t.protein_g)} g P · ${fmt(t.carbs_g)} g H · ${fmt(t.fat_g)} g G`;
}

// ---------------------------------------------------------------- treino até ao fim do dia

export interface TrainingContext {
  hour: number;
  today: Array<{ type: string; title: string; status: string; firstStep?: string | null }>;
  doneTypes: string[]; // tipos de atividades feitas hoje (corrida, força…)
  tomorrow?: { type: string; title: string } | null;
  steps?: number | null;
}

export function trainingLines(c: TrainingContext): string[] {
  const out: string[] = [];
  const isRun = (t: string) => ["fácil", "qualidade", "longo", "prova", "recuperação"].includes(t);
  for (const w of c.today) {
    if (w.type === "descanso") {
      out.push("Hoje é descanso: no máximo mobilidade ou uma caminhada leve.");
      continue;
    }
    const done = w.status === "feito" || (isRun(w.type) && c.doneTypes.includes("corrida")) || (w.type === "força" && c.doneTypes.includes("força"));
    if (done) out.push(`✓ ${w.title} — feito.`);
    else if (c.hour >= 22) out.push(`${w.title} ficou por fazer hoje. Não compenses amanhã: segue o plano.`);
    else out.push(`Ainda tens: ${w.title}${w.firstStep ? ` (${w.firstStep})` : ""}.`);
  }
  if (c.steps !== null && c.steps !== undefined && c.hour >= 17 && c.steps < 7000) out.push(`Passos: ${fmt(c.steps)}. Uma caminhada de 20 min ajuda a recuperação.`);
  if (c.tomorrow) {
    const hard = ["longo", "qualidade", "prova"].includes(c.tomorrow.type);
    out.push(`Amanhã: ${c.tomorrow.title.replace(/^🏁\s*/, "")}.${hard ? " Deita-te cedo (≥ 7h30 de sono) e não deixes os hidratos para o fim." : ""}`);
  }
  return out;
}
