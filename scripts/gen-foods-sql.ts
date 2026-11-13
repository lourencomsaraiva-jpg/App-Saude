/** Gera supabase/manual/alimentos.sql: insere os alimentos de lib/defaults.ts que ainda faltam (não altera os existentes). */
import { writeFileSync } from "node:fs";
import { checkKcalConsistency } from "../lib/calc/nutrition";
import { DEFAULT_FOODS } from "../lib/defaults";

const q = (v: string | number | null) => (v === null ? "null" : typeof v === "number" ? String(v) : `'${v.replace(/'/g, "''")}'`);
const bad = DEFAULT_FOODS.filter((f) => !checkKcalConsistency(f).ok).map((f) => f.name);
if (bad.length) console.warn("kcal incoerentes:", bad.join(", "));
const values = DEFAULT_FOODS.map((f) => `  (${q(f.name)}, ${q(f.serving)}, ${q(f.serving_g)}, ${f.kcal}, ${f.protein_g}, ${f.carbs_g}, ${f.fat_g}, ${f.fiber_g}, ${f.favorite ? "true" : "false"})`).join(",\n");
const sql = `-- Acrescenta à tabela de alimentos os que faltam (os existentes não são alterados). Pode correr-se várias vezes.
insert into public.foods (user_id, name, serving, serving_g, kcal, protein_g, carbs_g, fat_g, fiber_g, is_favorite)
select p.user_id, v.name, v.serving, v.serving_g, v.kcal, v.protein_g, v.carbs_g, v.fat_g, v.fiber_g, v.fav
from public.profile p
cross join (values
${values}
) as v(name, serving, serving_g, kcal, protein_g, carbs_g, fat_g, fiber_g, fav)
on conflict (user_id, name) do nothing;
`;
writeFileSync("supabase/manual/alimentos.sql", sql);
console.log(DEFAULT_FOODS.length, "alimentos");
