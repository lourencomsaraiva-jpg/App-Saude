/**
 * Importação do histórico (seed_entries.json). Partilhado pelo script e pelo ecrã de Definições.
 *
 * - days: peso, notas originais e o gasto de exercício bruto (prevalece sobre atividades).
 * - sleep: a partir do texto ("7:35 (profundo 1:37, …)"). A linha do dia D já segue a convenção X−1.
 * - meals: uma refeição "Histórico importado" por dia com os totais (não separa itens).
 * - activities: uma por dia com distância/gasto (source 'seed'); a sincronização do Intervals.icu
 *   substitui-as sem mexer nos totais do dia.
 */
import { parseDecimal } from "../calc/numbers";
import { parseHrText, parsePace } from "../calc/running";
import { parseSleepText, validateSleep } from "../calc/sleep";
import { isISODate } from "../calc/dates";
import type { DB } from "../types";
import { upsertGrouped } from "../db-utils";

export interface SeedEntry {
  data: string;
  peso?: string;
  caloriasConsumidas?: string;
  gastoNormal?: string;
  gastoExercicio?: string;
  proteina?: string;
  hidratos?: string;
  gordura?: string;
  fibra?: string;
  passos?: string;
  distancia?: string;
  ritmo?: string;
  fc?: string;
  sono?: string;
  notas?: string;
}

const dec = (v: string | undefined) => (v === undefined || v.trim() === "" ? null : parseDecimal(v));
const r1 = (v: number | null) => (v === null ? null : Math.round(v * 10) / 10);

export function inferActivityType(e: SeedEntry): string {
  const text = `${e.distancia ?? ""} ${e.fc ?? ""} ${e.notas ?? ""}`.toLowerCase();
  if (/\/\s*100\s*m/i.test(e.ritmo ?? "") || /nata[çc][ãa]o|piscina/.test(`${e.distancia ?? ""} ${e.fc ?? ""}`.toLowerCase())) return "natação";
  if (e.ritmo && parsePace(e.ritmo)) return "corrida";
  if (/bicicleta|ciclismo/.test(`${e.distancia ?? ""} ${e.fc ?? ""}`.toLowerCase())) return "bicicleta";
  if (/corrida|longo|fácil|facil|séries|series|intervalad|prova/.test(text) && dec(e.distancia)) return "corrida";
  if (/força|forca|hiit|ginásio/.test(text)) return "força";
  return "outro";
}

export function mapSeedEntry(e: SeedEntry) {
  if (!isISODate(e.data)) throw new Error(`Data inválida: ${e.data}`);
  const date = e.data;
  const kcalRaw = dec(e.gastoExercicio);
  const distanceKm = dec(e.distancia);
  const sleep = parseSleepText(e.sono);
  const type = inferActivityType(e);
  const pace = parsePace(e.ritmo);
  const hr = parseHrText(e.fc);
  const hasActivity = (distanceKm ?? 0) > 0 || (kcalRaw ?? 0) > 0;

  return {
    day: {
      date,
      weight_kg: r1(dec(e.peso)),
      weight_source: dec(e.peso) !== null ? "seed" : null,
      steps: dec(e.passos),
      steps_source: dec(e.passos) !== null ? "seed" : null,
      notes: e.notas?.trim() || null,
      exercise_kcal_raw_override: kcalRaw ?? 0,
      base_burn_kcal: dec(e.gastoNormal),
    },
    sleep: sleep ? { day_date: date, ...sleep, source: "seed" as const, valid: validateSleep(sleep).ok } : null,
    mealItem: {
      description: "Histórico importado (totais do dia)",
      kcal: r1(dec(e.caloriasConsumidas)) ?? 0,
      protein_g: r1(dec(e.proteina)),
      carbs_g: r1(dec(e.hidratos)),
      fat_g: r1(dec(e.gordura)),
      fiber_g: r1(dec(e.fibra)),
      source: "seed",
      weight_confirmed: false,
      needs_review: false,
    },
    activity: hasActivity
      ? {
          external_id: `seed-${date}`,
          source: "seed",
          name: `Histórico ${date}`,
          type,
          local_date: date,
          distance_m: distanceKm ? Math.round(distanceKm * 1000) : null,
          moving_time_s: pace && distanceKm && type === "corrida" ? Math.round(pace * 60 * distanceKm) : null,
          avg_hr: hr.avg,
          max_hr: hr.max,
          kcal_raw: kcalRaw,
          raw: { distancia: e.distancia ?? "", ritmo: e.ritmo ?? "", fc: e.fc ?? "" },
        }
      : null,
  };
}

export interface ImportResult {
  days: number;
  sleep: number;
  sleepInvalid: string[];
  meals: number;
  activities: number;
  warnings: string[];
}

export async function importSeed(db: DB, userId: string, entries: SeedEntry[]): Promise<ImportResult> {
  const mapped = entries.map(mapSeedEntry);
  const warnings: string[] = [];
  const baseBurns = new Set(mapped.map((m) => m.day.base_burn_kcal).filter((v) => v !== null));
  if (baseBurns.size > 1) warnings.push(`Gasto base varia no histórico (${[...baseBurns].join(", ")}); a app usa o valor do perfil.`);

  const must = async (p: PromiseLike<{ error: { message: string } | null }>, what: string) => {
    const r = await p;
    if (r.error) throw new Error(`${what}: ${r.error.message}`);
  };

  // days (merge: só campos do histórico; agrupado por colunas para não apagar valores existentes)
  const dayRows = mapped.map(({ day }) => {
    const row: Record<string, unknown> = { user_id: userId, date: day.date, notes: day.notes, exercise_kcal_raw_override: day.exercise_kcal_raw_override };
    if (day.weight_kg !== null) Object.assign(row, { weight_kg: day.weight_kg, weight_source: "seed" });
    if (day.steps !== null) Object.assign(row, { steps: day.steps, steps_source: "seed" });
    return row;
  });
  await must(upsertGrouped(db, "days", dayRows, "user_id,date"), "Dias");

  // sleep (não substitui registos manuais ou do Intervals)
  const sleeps = mapped.map((m) => m.sleep).filter((s): s is NonNullable<typeof s> => !!s);
  const { data: existingSleep } = await db.from("sleep").select("day_date, source").eq("user_id", userId);
  const protectedDates = new Set((existingSleep ?? []).filter((s: { source: string }) => s.source !== "seed").map((s: { day_date: string }) => s.day_date));
  const sleepRows = sleeps.filter((s) => !protectedDates.has(s.day_date)).map(({ valid: _v, ...s }) => {
    void _v;
    return { ...s, user_id: userId };
  });
  if (sleepRows.length) await must(db.from("sleep").upsert(sleepRows, { onConflict: "user_id,day_date" }), "Sono");

  // meals: apaga as refeições de histórico anteriores dessas datas e recria
  const dates = mapped.map((m) => m.day.date);
  for (const chunk of chunks(dates, 200)) await must(db.from("meals").delete().eq("user_id", userId).eq("label", "histórico").in("date", chunk), "Limpar histórico");
  for (const chunk of chunks(mapped, 100)) {
    const { data: meals, error } = await db
      .from("meals")
      .insert(chunk.map((m) => ({ user_id: userId, date: m.day.date, label: "histórico", notes: "Histórico importado" })))
      .select("id, date");
    if (error) throw new Error(`Refeições: ${error.message}`);
    const byDate = new Map((meals ?? []).map((m: { id: string; date: string }) => [m.date, m.id]));
    await must(db.from("meal_items").insert(chunk.map((m) => ({ ...m.mealItem, user_id: userId, meal_id: byDate.get(m.day.date) }))), "Itens");
  }

  // activities (seed); não recria se já houver atividades do Intervals/FIT nesse dia
  const { data: realActs } = await db.from("activities").select("local_date").eq("user_id", userId).in("source", ["intervals", "fit", "manual"]);
  const realDates = new Set((realActs ?? []).map((a: { local_date: string }) => a.local_date));
  const acts = mapped.map((m) => m.activity).filter((a): a is NonNullable<typeof a> => !!a && !realDates.has(a.local_date));
  for (const chunk of chunks(acts, 200)) await must(db.from("activities").upsert(chunk.map((a) => ({ ...a, user_id: userId })), { onConflict: "user_id,source,external_id" }), "Atividades");

  return {
    days: mapped.length,
    sleep: sleepRows.length,
    sleepInvalid: sleeps.filter((s) => !s.valid).map((s) => s.day_date),
    meals: mapped.length,
    activities: acts.length,
    warnings,
  };
}

function chunks<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
