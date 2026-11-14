/**
 * Ordena os alimentos para o separador Favoritos conforme a refeição escolhida:
 * 1) os que mais registaste nessa refeição (últimos 120 dias); 2) os que mais registaste noutras refeições;
 * 3) os típicos dessa refeição (até haver histórico suficiente); 4) o resto dos favoritos por nome.
 */
export interface RankFood {
  id: string;
  name: string;
  is_favorite: boolean;
}
export interface UsageRow {
  food_id: string | null;
  description: string;
  label: string;
}
/** label → food_id → n.º de vezes */
export type Usage = Record<string, Record<string, number>>;

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

/** Conta usos por refeição. Itens sem food_id são associados pelo nome (descrições "Nome (dose)"). */
export function buildUsage(rows: UsageRow[], foods: RankFood[]): Usage {
  const byName = [...foods].sort((a, b) => b.name.length - a.name.length).map((f) => ({ id: f.id, n: norm(f.name) }));
  const out: Usage = {};
  for (const r of rows) {
    if (!r.label || r.label === "histórico") continue;
    const d = norm(r.description);
    const id = r.food_id ?? byName.find((f) => f.n.length >= 4 && d.startsWith(f.n))?.id;
    if (!id) continue;
    (out[r.label] ??= {})[id] = (out[r.label][id] ?? 0) + 1;
  }
  return out;
}

const TYPICAL: Record<string, RegExp> = {
  "pequeno-almoço": /pao|cacetinho|bola|torrada|iogurte|aveia|ovo|cafe|leite|fiambre|queijo|whey|banana|kiwi|fruta|cereais|manteiga|compota/,
  almoço: /frango|peru|bife|carne|peixe|bacalhau|salmao|atum|pescada|arroz|massa|batata|legumes|salada|sopa|feijao|grao|lentilhas|azeite/,
  lanche: /iogurte|fruta|banana|maca|kiwi|whey|gelatina|barra|frutos secos|amendoa|noz|queijo|pao|bolacha|tostas/,
  jantar: /frango|peru|bife|carne|peixe|bacalhau|salmao|atum|pescada|arroz|massa|batata|legumes|salada|sopa|feijao|grao|lentilhas|azeite|ovo|espinafre/,
  extra: /iogurte|gelatina|whey|fruta|chocolate|bolacha|gomas|frutos secos/,
};

export function rankFoods<T extends RankFood>(foods: T[], usage: Usage, label: string, limit = 24): T[] {
  const here = usage[label] ?? {};
  const anywhere: Record<string, number> = {};
  for (const m of Object.values(usage)) for (const [id, n] of Object.entries(m)) anywhere[id] = (anywhere[id] ?? 0) + n;
  const typical = TYPICAL[label];
  const score = (f: T) => (here[f.id] ?? 0) * 1000 + (anywhere[f.id] ?? 0) * 10 + (typical?.test(norm(f.name)) ? 5 : 0);
  return foods
    .filter((f) => f.is_favorite || here[f.id])
    .sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name, "pt"))
    .slice(0, limit);
}
