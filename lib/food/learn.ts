/**
 * Aprende alimentos novos: quando se grava um alimento estimado (texto, foto ou à mão) que não existe
 * na tabela pessoal, é acrescentado aos favoritos, normalizado por dose (1 un. ou 100 g/ml), para da
 * próxima vez ser reconhecido sem IA.
 */
import { round1 } from "../calc/numbers";
import { checkKcalConsistency } from "../calc/nutrition";
import type { DB } from "../types";
import { bestFood, normalize, type LocalFood } from "./local-match";

export interface LearnableItem {
  description: string;
  quantity: number | null;
  unit: string | null;
  kcal: number;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
}

/** Nome limpo: sem quantidades, parênteses nem "~". "Bolachas de manteiga (4 un.)" → "Bolachas de manteiga". */
export function cleanName(description: string): string {
  return description
    .replace(/\(.*?\)/g, " ")
    .replace(/[~≈]/g, " ")
    .replace(/\b\d+(?:[.,]\d+)?\s*(?:g|gr|gramas?|ml|kg|un\.?|unidades?|fatias?|doses?|x|×)?(?=\s|$)/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(de|da|do)\s+/i, "")
    .replace(/^./, (c) => c.toUpperCase());
}

/** Converte um item comido em alimento "por dose": por unidade, ou por 100 g/ml. */
export function itemToFood(i: LearnableItem): Omit<LocalFood, "id"> | null {
  const name = cleanName(i.description);
  if (name.length < 3 || !i.kcal || i.kcal <= 0) return null;
  const v = { kcal: i.kcal, protein_g: i.protein_g ?? 0, carbs_g: i.carbs_g ?? 0, fat_g: i.fat_g ?? 0, fiber_g: i.fiber_g ?? 0 };
  if (!checkKcalConsistency(v).ok) return null; // não aprender estimativas incoerentes
  const unit = (i.unit ?? "").toLowerCase().replace(/\.$/, "");
  const q = i.quantity && i.quantity > 0 ? i.quantity : null;
  const per = (f: number) => ({ kcal: round1(v.kcal * f), protein_g: round1(v.protein_g * f), carbs_g: round1(v.carbs_g * f), fat_g: round1(v.fat_g * f), fiber_g: round1(v.fiber_g * f) });
  if (q && (unit === "g" || unit === "ml")) return { name, serving: `100 ${unit}`, serving_g: 100, ...per(100 / q) };
  if (q && (unit === "un" || unit === "unidade" || unit === "unidades")) return { name, serving: "1 un.", serving_g: null, ...per(1 / q) };
  return { name, serving: q && unit ? `${q} ${unit}` : "1 dose", serving_g: null, ...v };
}

export async function learnFoods(db: DB, userId: string, items: LearnableItem[]): Promise<string[]> {
  const { data } = await db.from("foods").select("id, name, serving, serving_g, kcal, protein_g, carbs_g, fat_g, fiber_g").eq("user_id", userId);
  const known = ((data ?? []) as LocalFood[]).map((f) => ({ ...f, kcal: Number(f.kcal) }));
  const names = new Set(known.map((f) => normalize(f.name).trim()));
  const learned: string[] = [];
  for (const i of items) {
    const f = itemToFood(i);
    if (!f) continue;
    const key = normalize(f.name).trim();
    if (names.has(key) || bestFood(f.name, known)) continue;
    const { error } = await db.from("foods").insert({ user_id: userId, ...f, is_favorite: true });
    if (!error) {
      names.add(key);
      learned.push(f.name);
    }
  }
  return learned;
}
