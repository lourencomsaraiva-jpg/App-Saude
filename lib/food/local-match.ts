/**
 * Reconhecimento local de texto livre contra a tabela pessoal de alimentos (sem IA).
 * Ex.: "Dois mini kit kat e 50 gramas de gomas" → Mini Kit Kat × 2 (+ "gomas" por reconhecer).
 */
import { round1 } from "../calc/numbers";
import { scaleNutrients } from "../calc/nutrition";

export interface LocalFood {
  id: string;
  name: string;
  serving: string;
  serving_g: number | null;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
}

export interface MatchedItem {
  description: string;
  quantity: number | null;
  unit: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  weight_confirmed: boolean;
  food_id: string;
}

const NUMBER_WORDS: Record<string, number> = {
  um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10,
  meio: 0.5, meia: 0.5,
};
const STOP = new Set(["de", "da", "do", "das", "dos", "com", "e", "a", "o", "as", "os", "um", "uma", "g", "gr", "grs", "gramas", "grama", "ml", "un", "unidade", "unidades", "fatia", "fatias", "colher", "colheres", "dose", "doses", "pequeno", "pequena", "grande", "x"]);

export function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9,.\s/]/g, " ");
}

function stem(w: string): string {
  // plural simples em português: bolachas→bolacha, paes→pae (suficiente para comparar)
  return w.length > 3 && w.endsWith("s") ? w.slice(0, -1) : w;
}

function words(s: string): string[] {
  return normalize(s).split(/\s+/).filter((w) => w && !STOP.has(w) && !/^\d/.test(w) && !(w in NUMBER_WORDS)).map(stem);
}

/** Divide "a, b e c" em segmentos. */
export function splitSegments(text: string): string[] {
  return normalize(text)
    .split(/,|;|\n|\s+e\s+|\s+mais\s+|\+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Quantidade de um segmento: gramas/ml ou número de unidades. */
export function parseQuantity(seg: string): { grams: number | null; count: number | null } {
  const g = seg.match(/(\d+(?:[.,]\d+)?)\s*(g|gr|grs|gramas?|ml)\b/);
  if (g) return { grams: Number(g[1].replace(",", ".")), count: null };
  const num = seg.match(/(^|\s)(\d+(?:[.,]\d+)?)(\s|$|x)/);
  if (num) return { grams: null, count: Number(num[2].replace(",", ".")) };
  for (const w of seg.split(/\s+/)) if (w in NUMBER_WORDS) return { grams: null, count: NUMBER_WORDS[w] };
  return { grams: null, count: null };
}

export function bestFood(seg: string, foods: LocalFood[]): LocalFood | null {
  const sw = words(seg);
  if (!sw.length) return null;
  let best: LocalFood | null = null;
  let bestScore = 0;
  for (const f of foods) {
    const fw = new Set(words(f.name));
    const hits = sw.filter((w) => fw.has(w)).length;
    // todas as palavras do segmento têm de existir no nome do alimento
    if (hits !== sw.length) continue;
    const score = hits * 10 - fw.size; // prefere o nome mais curto/específico
    if (score > bestScore) {
      bestScore = score;
      best = f;
    }
  }
  return best;
}

export function matchLocal(text: string, foods: LocalFood[]): { matched: MatchedItem[]; unmatched: string[] } {
  const matched: MatchedItem[] = [];
  const unmatched: string[] = [];
  for (const seg of splitSegments(text)) {
    const f = bestFood(seg, foods);
    if (!f) {
      unmatched.push(seg);
      continue;
    }
    const q = parseQuantity(seg);
    let mult = 1;
    let quantity: number | null = f.serving_g;
    let unit = f.serving_g ? "g" : "dose";
    if (q.grams !== null && f.serving_g) {
      mult = q.grams / f.serving_g;
      quantity = q.grams;
    } else if (q.count !== null) {
      mult = q.count;
      quantity = f.serving_g ? round1(f.serving_g * q.count) : q.count;
      unit = f.serving_g ? "g" : "un.";
    } else if (!f.serving_g) {
      quantity = 1;
      unit = "un.";
    }
    const s = scaleNutrients({ kcal: f.kcal, protein_g: f.protein_g, carbs_g: f.carbs_g, fat_g: f.fat_g, fiber_g: f.fiber_g }, mult);
    matched.push({
      description: mult === 1 ? `${f.name} (${f.serving})` : `${f.name} (${round1(mult)} × ${f.serving})`,
      quantity,
      unit,
      kcal: s.kcal ?? 0,
      protein_g: s.protein_g ?? 0,
      carbs_g: s.carbs_g ?? 0,
      fat_g: s.fat_g ?? 0,
      fiber_g: s.fiber_g ?? 0,
      weight_confirmed: q.grams !== null || q.count !== null,
      food_id: f.id,
    });
  }
  return { matched, unmatched };
}
