import type { DB } from "./types";

/**
 * Upsert seguro para linhas com colunas diferentes.
 * Num upsert em lote o PostgREST usa a união das colunas e põe a NULL as que faltam numa linha —
 * o que apagaria, por exemplo, um peso manual. Aqui cada grupo tem exatamente as mesmas colunas.
 */
export async function upsertGrouped(db: DB, table: string, rows: Array<Record<string, unknown>>, onConflict: string): Promise<{ error: { message: string } | null }> {
  const groups = new Map<string, Array<Record<string, unknown>>>();
  for (const r of rows) {
    const key = Object.keys(r).sort().join(",");
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  for (const g of groups.values()) {
    for (let i = 0; i < g.length; i += 500) {
      const { error } = await db.from(table).upsert(g.slice(i, i + 500), { onConflict });
      if (error) return { error };
    }
  }
  return { error: null };
}

export function groupByKeys(rows: Array<Record<string, unknown>>) {
  const groups = new Map<string, Array<Record<string, unknown>>>();
  for (const r of rows) {
    const key = Object.keys(r).sort().join(",");
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  return [...groups.values()];
}
