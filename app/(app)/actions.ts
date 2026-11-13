"use server";
/**
 * Server actions (mutações). Todas passam por requireUser() e usam o cliente com RLS.
 */
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { estimateFromPhoto, estimateFromText, type EstimatedItem } from "@/lib/ai/food";
import { analyzeActivity, coachChat, raceProjection, weeklyReview } from "@/lib/ai/coach-actions";
import { isISODate, todayInTz } from "@/lib/calc/dates";
import { parseDecimal, parseMultiplier, round1 } from "@/lib/calc/numbers";
import { checkKcalConsistency, scaleNutrients } from "@/lib/calc/nutrition";
import { matchLocal } from "@/lib/food/local-match";
import { parseDurationHms } from "@/lib/calc/running";
import { parseSleepText, validateSleep } from "@/lib/calc/sleep";
import { importSeed, type SeedEntry } from "@/lib/import/seed";
import { parseFit } from "@/lib/integrations/fit";
import { intervalsConfigFromEnv } from "@/lib/integrations/intervals";
import { linkActivitiesToPlan } from "@/lib/sync/link-plan";
import { MEAL_LABELS, type FoodRow, type MealLabel } from "@/lib/types";

type Result<T = undefined> = { ok: true; data?: T; message?: string } | { ok: false; message: string };
const fail = (message: string): Result<never> => ({ ok: false, message });
const refresh = () => revalidatePath("/", "layout");
const label = (l: unknown): MealLabel => (MEAL_LABELS.includes(l as MealLabel) ? (l as MealLabel) : "extra");
const nOrNull = (v: unknown) => {
  if (v === null || v === undefined || v === "") return null;
  const n = parseDecimal(String(v));
  return n === null ? null : round1(n);
};

// ------------------------------------------------------------------ dia: peso, notas, sono, passos
export async function saveWeight(date: string, value: string): Promise<Result> {
  const { supabase, user } = await requireUser();
  if (!isISODate(date)) return fail("Data inválida.");
  const kg = nOrNull(value);
  if (kg !== null && (kg < 30 || kg > 250)) return fail("Peso fora do intervalo.");
  const { error } = await supabase.from("days").upsert({ user_id: user.id, date, weight_kg: kg, weight_source: kg === null ? null : "manual" }, { onConflict: "user_id,date" });
  if (error) return fail(error.message);
  refresh();
  return { ok: true };
}

export async function saveDayFields(date: string, fields: { notes?: string; steps?: string; exercise_kcal_raw_override?: string }): Promise<Result> {
  const { supabase, user } = await requireUser();
  if (!isISODate(date)) return fail("Data inválida.");
  const row: Record<string, unknown> = { user_id: user.id, date };
  if (fields.notes !== undefined) row.notes = fields.notes.trim() || null;
  if (fields.steps !== undefined) {
    const s = nOrNull(fields.steps);
    row.steps = s === null ? null : Math.round(s);
    row.steps_source = s === null ? null : "manual";
  }
  if (fields.exercise_kcal_raw_override !== undefined) row.exercise_kcal_raw_override = nOrNull(fields.exercise_kcal_raw_override);
  const { error } = await supabase.from("days").upsert(row, { onConflict: "user_id,date" });
  if (error) return fail(error.message);
  refresh();
  return { ok: true };
}

/** Sono manual: aceita "7:35 (profundo 1:37, leve 4:49, REM 1:09, acordado 27min)" ou só "7:35". `dayDate` segue a convenção X−1. */
export async function saveSleep(dayDate: string, text: string, score?: string): Promise<Result> {
  const { supabase, user } = await requireUser();
  if (!isISODate(dayDate)) return fail("Data inválida.");
  if (!text.trim()) {
    await supabase.from("sleep").delete().eq("user_id", user.id).eq("day_date", dayDate);
    refresh();
    return { ok: true };
  }
  const parsed = parseSleepText(text);
  if (!parsed) return fail("Formato não reconhecido. Ex.: 7:35 (profundo 1:37, leve 4:49, REM 1:09, acordado 27min)");
  const v = validateSleep(parsed);
  if (!v.ok) return fail(v.message ?? "Sono inválido.");
  const { error } = await supabase.from("sleep").upsert({ user_id: user.id, day_date: dayDate, ...parsed, score: nOrNull(score), source: "manual" }, { onConflict: "user_id,day_date" });
  if (error) return fail(error.message);
  refresh();
  return { ok: true };
}

// ------------------------------------------------------------------ comida
export interface ItemInput {
  description: string;
  quantity: number | null;
  unit: string | null;
  kcal: number;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  weight_confirmed: boolean;
  food_id?: string | null;
}

async function getOrCreateMeal(date: string, mealLabel: MealLabel, photoPath?: string | null) {
  const { supabase, user } = await requireUser();
  if (!photoPath) {
    const { data } = await supabase.from("meals").select("id").eq("date", date).eq("label", mealLabel).is("photo_path", null).order("created_at").limit(1).maybeSingle();
    if (data) return data.id as string;
  }
  const now = new Intl.DateTimeFormat("en-GB", { timeZone: process.env.APP_TIMEZONE || "Europe/Lisbon", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
  const { data, error } = await supabase.from("meals").insert({ user_id: user.id, date, label: mealLabel, photo_path: photoPath ?? null, eaten_at: date === todayInTz() ? now : null }).select("id").single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function addItems(date: string, mealLabel: string, items: ItemInput[], source: string, photoPath?: string | null): Promise<Result> {
  const { supabase, user } = await requireUser();
  if (!isISODate(date)) return fail("Data inválida.");
  if (!items.length) return fail("Sem alimentos.");
  const mealId = await getOrCreateMeal(date, label(mealLabel), photoPath);
  // posição pelo relógio (ordem cronológica) — evita uma leitura extra à base de dados
  const start = Math.floor(Date.now() / 1000) % 1_000_000_000;
  const rows = items.map((i, idx) => {
    const v = { kcal: round1(Number(i.kcal) || 0), protein_g: nOrNull(i.protein_g), carbs_g: nOrNull(i.carbs_g), fat_g: nOrNull(i.fat_g), fiber_g: nOrNull(i.fiber_g) };
    return {
      user_id: user.id,
      meal_id: mealId,
      food_id: i.food_id ?? null,
      position: start + idx,
      description: i.description.trim() || "Alimento",
      quantity: i.quantity === null ? null : round1(Number(i.quantity)),
      unit: i.unit,
      ...v,
      weight_confirmed: !!i.weight_confirmed,
      source,
      needs_review: !checkKcalConsistency(v).ok,
    };
  });
  const { error } = await supabase.from("meal_items").insert(rows);
  if (error) return fail(error.message);
  refresh();
  return { ok: true, message: `${rows.length} ${rows.length === 1 ? "item adicionado" : "itens adicionados"}.` };
}

export async function addFood(date: string, mealLabel: string, foodId: string, multiplier: string): Promise<Result> {
  const { supabase } = await requireUser();
  const mult = parseMultiplier(multiplier || "1");
  if (!mult) return fail("Multiplicador inválido.");
  const { data: f } = await supabase.from("foods").select("*").eq("id", foodId).single();
  if (!f) return fail("Alimento não encontrado.");
  const food = f as FoodRow;
  const n = scaleNutrients({ kcal: Number(food.kcal), protein_g: Number(food.protein_g), carbs_g: Number(food.carbs_g), fat_g: Number(food.fat_g), fiber_g: Number(food.fiber_g) }, mult);
  return addItems(date, mealLabel, [{ description: mult === 1 ? `${food.name} (${food.serving})` : `${food.name} (${round1(mult)} × ${food.serving})`, quantity: food.serving_g ? round1(food.serving_g * mult) : round1(mult), unit: food.serving_g ? "g" : "dose", ...n, kcal: n.kcal ?? 0, weight_confirmed: false, food_id: food.id }], "favorite");
}

export async function addRecipe(date: string, mealLabel: string | null, recipeId: string, portions: string): Promise<Result> {
  const { supabase } = await requireUser();
  const { data: r } = await supabase.from("recipes").select("*, recipe_items(*)").eq("id", recipeId).single();
  if (!r) return fail("Receita não encontrada.");
  const mult = parseMultiplier(portions || "1");
  if (!mult) return fail("Porções inválidas.");
  const items = (r.recipe_items ?? []) as Array<ItemInput & { position: number }>;
  if (r.kind === "favorite_meal") {
    return addItems(
      date,
      mealLabel ?? r.default_label ?? "extra",
      items
        .sort((a, b) => a.position - b.position)
        .map((i) => {
          const s = scaleNutrients({ kcal: Number(i.kcal), protein_g: nOrNull(i.protein_g), carbs_g: nOrNull(i.carbs_g), fat_g: nOrNull(i.fat_g), fiber_g: nOrNull(i.fiber_g) }, mult);
          return { description: i.description, quantity: i.quantity, unit: i.unit, ...s, kcal: s.kcal ?? 0, weight_confirmed: false, food_id: i.food_id ?? null };
        }),
      "favorite",
    );
  }
  // receita: soma e divide pelas porções
  const per = mult / Number(r.portions || 1);
  const totals = items.reduce(
    (t, i) => ({ kcal: t.kcal + Number(i.kcal), protein_g: t.protein_g + Number(i.protein_g ?? 0), carbs_g: t.carbs_g + Number(i.carbs_g ?? 0), fat_g: t.fat_g + Number(i.fat_g ?? 0), fiber_g: t.fiber_g + Number(i.fiber_g ?? 0) }),
    { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 },
  );
  const s = scaleNutrients(totals, per);
  return addItems(date, mealLabel ?? "extra", [{ description: `${r.name} (${round1(mult)} porç.)`, quantity: round1(mult), unit: "porção", ...s, kcal: s.kcal ?? 0, weight_confirmed: false }], "recipe");
}

export async function updateItem(id: string, fields: Partial<ItemInput>): Promise<Result> {
  const { supabase } = await requireUser();
  const { data: cur } = await supabase.from("meal_items").select("*").eq("id", id).single();
  if (!cur) return fail("Item não encontrado.");
  const merged = { ...cur, ...fields };
  const v = { kcal: round1(Number(merged.kcal) || 0), protein_g: nOrNull(merged.protein_g), carbs_g: nOrNull(merged.carbs_g), fat_g: nOrNull(merged.fat_g), fiber_g: nOrNull(merged.fiber_g) };
  const { error } = await supabase
    .from("meal_items")
    .update({ description: merged.description, quantity: merged.quantity === null || merged.quantity === "" ? null : round1(Number(merged.quantity)), unit: merged.unit, ...v, weight_confirmed: !!merged.weight_confirmed, needs_review: !checkKcalConsistency(v).ok })
    .eq("id", id);
  if (error) return fail(error.message);
  refresh();
  return { ok: true };
}

/** Altera o peso de um item e reescala os valores proporcionalmente (peso passa a confirmado). */
export async function rescaleItem(id: string, newQuantity: string): Promise<Result> {
  const { supabase } = await requireUser();
  const { data: cur } = await supabase.from("meal_items").select("*").eq("id", id).single();
  if (!cur) return fail("Item não encontrado.");
  const q = nOrNull(newQuantity);
  if (!q || !cur.quantity) return fail("Quantidade inválida.");
  const s = scaleNutrients({ kcal: Number(cur.kcal), protein_g: nOrNull(cur.protein_g), carbs_g: nOrNull(cur.carbs_g), fat_g: nOrNull(cur.fat_g), fiber_g: nOrNull(cur.fiber_g) }, q / Number(cur.quantity));
  return updateItem(id, { ...s, kcal: s.kcal ?? 0, quantity: q, weight_confirmed: true });
}

export async function deleteItem(id: string): Promise<Result> {
  const { supabase } = await requireUser();
  const { data: item } = await supabase.from("meal_items").select("meal_id").eq("id", id).single();
  const { error } = await supabase.from("meal_items").delete().eq("id", id);
  if (error) return fail(error.message);
  if (item) {
    const { count } = await supabase.from("meal_items").select("id", { count: "exact", head: true }).eq("meal_id", item.meal_id);
    if (!count) await supabase.from("meals").delete().eq("id", item.meal_id);
  }
  refresh();
  return { ok: true };
}

export async function deleteMeal(id: string): Promise<Result> {
  const { supabase } = await requireUser();
  const { data: meal } = await supabase.from("meals").select("photo_path").eq("id", id).single();
  const { error } = await supabase.from("meals").delete().eq("id", id);
  if (error) return fail(error.message);
  if (meal?.photo_path) await supabase.storage.from("uploads").remove([meal.photo_path]);
  refresh();
  return { ok: true };
}

export async function moveMeal(id: string, newLabel: string): Promise<Result> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("meals").update({ label: label(newLabel) }).eq("id", id);
  if (error) return fail(error.message);
  refresh();
  return { ok: true };
}

/** "Igual a…": copia uma refeição de outro dia com multiplicador (ex.: 3/5). */
export async function copyMeal(mealId: string, toDate: string, toLabel: string, multiplier: string): Promise<Result> {
  const { supabase } = await requireUser();
  const mult = parseMultiplier(multiplier || "1");
  if (!mult) return fail("Multiplicador inválido. Ex.: 1, 0,5 ou 3/5.");
  const { data: meal } = await supabase.from("meals").select("label, meal_items(*)").eq("id", mealId).single();
  if (!meal) return fail("Refeição não encontrada.");
  const items = ((meal.meal_items ?? []) as Array<ItemInput & { position: number }>).sort((a, b) => a.position - b.position);
  return addItems(
    toDate,
    toLabel || meal.label,
    items.map((i) => {
      const s = scaleNutrients({ kcal: Number(i.kcal), protein_g: nOrNull(i.protein_g), carbs_g: nOrNull(i.carbs_g), fat_g: nOrNull(i.fat_g), fiber_g: nOrNull(i.fiber_g) }, mult);
      return { description: mult === 1 ? i.description : `${i.description} (×${round1(mult)})`, quantity: i.quantity === null ? null : round1(Number(i.quantity) * mult), unit: i.unit, ...s, kcal: s.kcal ?? 0, weight_confirmed: i.weight_confirmed, food_id: i.food_id ?? null };
    }),
    "copy",
  );
}

export async function listMealsOn(date: string) {
  const { supabase } = await requireUser();
  if (!isISODate(date)) return [];
  const { data } = await supabase.from("meals").select("id, label, meal_items(description, kcal)").eq("date", date).order("created_at");
  return (data ?? []) as Array<{ id: string; label: string; meal_items: Array<{ description: string; kcal: number }> }>;
}

async function foodsForPrompt() {
  const { supabase } = await requireUser();
  const { data } = await supabase.from("foods").select("id, name, serving, serving_g, kcal, protein_g, carbs_g, fat_g, fiber_g").order("name").limit(200);
  return ((data ?? []) as FoodRow[]).map((f) => ({ ...f, kcal: Number(f.kcal), protein_g: Number(f.protein_g), carbs_g: Number(f.carbs_g), fat_g: Number(f.fat_g), fiber_g: Number(f.fiber_g), serving_g: f.serving_g === null ? null : Number(f.serving_g) }));
}

const asEstimated = (i: { description: string; quantity: number | null; unit: string; kcal: number; protein_g: number; carbs_g: number; fat_g: number; fiber_g: number; weight_confirmed: boolean }): EstimatedItem => {
  const c = checkKcalConsistency(i);
  return { ...i, needs_review: !c.ok, check_expected_kcal: c.expectedKcal };
};

/**
 * Texto livre: primeiro a tabela pessoal (instantâneo, sem IA); o que não for reconhecido vai ao Gemini.
 * Se o Gemini falhar, devolve na mesma a tabela com linhas vazias para completar à mão.
 */
export async function estimateText(text: string): Promise<Result<{ items: EstimatedItem[]; comment: string }>> {
  await requireUser();
  if (!text.trim()) return fail("Escreve o que comeste.");
  const foods = await foodsForPrompt();
  const { matched, unmatched } = matchLocal(text.slice(0, 2000), foods);
  const local = matched.map(asEstimated);
  if (unmatched.length === 0) return { ok: true, data: { items: local, comment: "Valores da tua tabela de alimentos." } };
  try {
    const ai = await estimateFromText(unmatched.join(", "), foods);
    return { ok: true, data: { items: [...local, ...ai.items], comment: local.length ? `Da tua tabela: ${local.length}; o resto foi estimado pela IA. ${ai.comment}` : ai.comment } };
  } catch (e) {
    const blanks = unmatched.map((u) => asEstimated({ description: u, quantity: null, unit: "g", kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0, weight_confirmed: true }));
    return { ok: true, data: { items: [...local, ...blanks], comment: `${(e as Error).message} Preenche à mão as linhas a 0.` } };
  }
}

/** Foto (já reduzida no browser) → Storage privado + estimativa. */
export async function estimatePhoto(dataUrl: string, hint: string): Promise<Result<{ items: EstimatedItem[]; comment: string; photoPath: string | null }>> {
  const { supabase, user } = await requireUser();
  const m = dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
  if (!m) return fail("Imagem inválida.");
  const [, mime, b64] = m;
  if (b64.length > 7_000_000) return fail("Imagem demasiado grande.");
  const path = `${user.id}/meals/${Date.now()}.${mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg"}`;
  const up = await supabase.storage.from("uploads").upload(path, Buffer.from(b64, "base64"), { contentType: mime, upsert: false });
  try {
    const est = await estimateFromPhoto(b64, mime, hint.slice(0, 500), await foodsForPrompt());
    return { ok: true, data: { ...est, photoPath: up.error ? null : path } };
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function saveFood(form: FormData): Promise<Result> {
  const { supabase, user } = await requireUser();
  const name = String(form.get("name") ?? "").trim();
  if (!name) return fail("Nome obrigatório.");
  const row = {
    user_id: user.id,
    name,
    serving: String(form.get("serving") ?? "1 dose").trim() || "1 dose",
    serving_g: nOrNull(form.get("serving_g")),
    kcal: nOrNull(form.get("kcal")) ?? 0,
    protein_g: nOrNull(form.get("protein_g")) ?? 0,
    carbs_g: nOrNull(form.get("carbs_g")) ?? 0,
    fat_g: nOrNull(form.get("fat_g")) ?? 0,
    fiber_g: nOrNull(form.get("fiber_g")) ?? 0,
    is_favorite: form.get("is_favorite") === "on",
  };
  const id = String(form.get("id") ?? "");
  const { error } = id ? await supabase.from("foods").update(row).eq("id", id) : await supabase.from("foods").upsert(row, { onConflict: "user_id,name" });
  if (error) return fail(error.message);
  refresh();
  return { ok: true };
}

export async function toggleFavoriteFood(id: string, fav: boolean): Promise<Result> {
  const { supabase } = await requireUser();
  await supabase.from("foods").update({ is_favorite: fav }).eq("id", id);
  refresh();
  return { ok: true };
}

export async function deleteFood(id: string): Promise<Result> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("foods").delete().eq("id", id);
  if (error) return fail(error.message);
  refresh();
  return { ok: true };
}

/** Guarda receita ou refeição favorita com os seus itens. */
export async function saveRecipe(input: { id?: string; name: string; kind: "recipe" | "favorite_meal"; portions: number; default_label?: string | null; notes?: string; items: ItemInput[] }): Promise<Result<{ id: string }>> {
  const { supabase, user } = await requireUser();
  if (!input.name.trim()) return fail("Nome obrigatório.");
  if (!input.items.length) return fail("Adiciona pelo menos um ingrediente.");
  const row = { user_id: user.id, name: input.name.trim(), kind: input.kind, portions: Math.max(0.1, Number(input.portions) || 1), default_label: input.default_label ?? null, notes: input.notes ?? null };
  const { data, error } = input.id ? await supabase.from("recipes").update(row).eq("id", input.id).select("id").single() : await supabase.from("recipes").insert(row).select("id").single();
  if (error || !data) return fail(error?.message ?? "Erro ao guardar.");
  await supabase.from("recipe_items").delete().eq("recipe_id", data.id);
  const { error: ie } = await supabase.from("recipe_items").insert(
    input.items.map((i, position) => ({ user_id: user.id, recipe_id: data.id, position, description: i.description, quantity: i.quantity, unit: i.unit, kcal: round1(Number(i.kcal) || 0), protein_g: nOrNull(i.protein_g), carbs_g: nOrNull(i.carbs_g), fat_g: nOrNull(i.fat_g), fiber_g: nOrNull(i.fiber_g), food_id: i.food_id ?? null })),
  );
  if (ie) return fail(ie.message);
  refresh();
  return { ok: true, data: { id: data.id } };
}

export async function deleteRecipe(id: string): Promise<Result> {
  const { supabase } = await requireUser();
  await supabase.from("recipes").delete().eq("id", id);
  refresh();
  return { ok: true };
}

/** Guarda uma refeição registada como favorito de um toque. */
export async function mealToFavorite(mealId: string, name: string): Promise<Result> {
  const { supabase } = await requireUser();
  const { data: meal } = await supabase.from("meals").select("label, meal_items(*)").eq("id", mealId).single();
  if (!meal) return fail("Refeição não encontrada.");
  const items = ((meal.meal_items ?? []) as Array<ItemInput & { position: number }>).sort((a, b) => a.position - b.position);
  const r = await saveRecipe({ name, kind: "favorite_meal", portions: 1, default_label: meal.label, items });
  return r.ok ? { ok: true, message: "Favorito criado." } : r;
}

// ------------------------------------------------------------------ treinos
export async function saveActivityNotes(id: string, conditions: string, feel: string): Promise<Result> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("activities").update({ conditions: conditions.trim() || null, feel: feel.trim() || null }).eq("id", id);
  if (error) return fail(error.message);
  refresh();
  return { ok: true };
}

export async function analyzeActivityNow(id: string): Promise<Result<string>> {
  const { supabase, user } = await requireUser();
  try {
    return { ok: true, data: await analyzeActivity(supabase, user.id, id) };
  } catch (e) {
    return fail((e as Error).message);
  } finally {
    refresh();
  }
}

export async function addManualActivity(form: FormData): Promise<Result> {
  const { supabase, user } = await requireUser();
  const date = String(form.get("date") ?? "");
  if (!isISODate(date)) return fail("Data inválida.");
  const km = nOrNull(form.get("distance_km"));
  const dur = parseDurationHms(String(form.get("duration") ?? ""));
  const { error } = await supabase.from("activities").insert({
    user_id: user.id,
    external_id: `manual-${Date.now()}`,
    source: "manual",
    name: String(form.get("name") ?? "").trim() || null,
    type: String(form.get("type") ?? "corrida"),
    local_date: date,
    distance_m: km === null ? null : Math.round(km * 1000),
    moving_time_s: dur,
    duration_s: dur,
    avg_hr: nOrNull(form.get("avg_hr")),
    max_hr: nOrNull(form.get("max_hr")),
    kcal_raw: nOrNull(form.get("kcal_raw")),
    ascent_m: nOrNull(form.get("ascent_m")),
  });
  if (error) return fail(error.message);
  await linkActivitiesToPlan(supabase, user.id, date, date);
  refresh();
  return { ok: true };
}

export async function deleteActivity(id: string): Promise<Result> {
  const { supabase } = await requireUser();
  const { data: a } = await supabase.from("activities").select("source, fit_path, planned_workout_id").eq("id", id).single();
  if (!a) return fail("Treino não encontrado.");
  if (a.source === "intervals") return fail("Treinos do Intervals.icu voltam na próxima sincronização; apaga-os no Intervals.icu/Garmin.");
  await supabase.from("activities").delete().eq("id", id);
  if (a.fit_path) await supabase.storage.from("uploads").remove([a.fit_path]);
  if (a.planned_workout_id) await supabase.from("planned_workouts").update({ status: "planeado" }).eq("id", a.planned_workout_id).eq("status", "feito");
  refresh();
  return { ok: true };
}

export async function uploadFit(form: FormData): Promise<Result<{ id: string }>> {
  const { supabase, user } = await requireUser();
  const file = form.get("file");
  if (!(file instanceof File) || !file.size) return fail("Escolhe um ficheiro .FIT.");
  if (file.size > 6_000_000) return fail("Ficheiro demasiado grande (máx. 6 MB).");
  const { data: log } = await supabase.from("sync_log").insert({ user_id: user.id, source: "fit", trigger: "upload", status: "running" }).select("id").single();
  try {
    const buf = await file.arrayBuffer();
    const parsed = await parseFit(buf);
    const path = `${user.id}/fit/${parsed.activity.external_id}.fit`;
    await supabase.storage.from("uploads").upload(path, Buffer.from(buf), { contentType: "application/octet-stream", upsert: true });
    const { data: act, error } = await supabase.from("activities").upsert({ ...parsed.activity, fit_path: path, user_id: user.id }, { onConflict: "user_id,source,external_id" }).select("id").single();
    if (error || !act) throw new Error(error?.message ?? "Erro ao gravar.");
    await supabase.from("activity_laps").delete().eq("activity_id", act.id);
    const laps = [...parsed.laps, ...parsed.splits].map((l) => ({ ...l, user_id: user.id, activity_id: act.id }));
    if (laps.length) await supabase.from("activity_laps").insert(laps);
    await supabase.from("activities").delete().eq("user_id", user.id).eq("source", "seed").eq("local_date", parsed.activity.local_date);
    await linkActivitiesToPlan(supabase, user.id, parsed.activity.local_date, parsed.activity.local_date);
    if (log) await supabase.from("sync_log").update({ status: "ok", finished_at: new Date().toISOString(), imported_count: 1, details: { file: file.name } }).eq("id", log.id);
    refresh();
    return { ok: true, data: { id: act.id } };
  } catch (e) {
    if (log) await supabase.from("sync_log").update({ status: "error", finished_at: new Date().toISOString(), error: (e as Error).message }).eq("id", log.id);
    return fail(`Não foi possível ler o FIT: ${(e as Error).message}`);
  }
}

// ------------------------------------------------------------------ plano
const WORKOUT_FIELDS = ["date", "type", "title", "distance_km", "target_pace_min_s", "target_pace_max_s", "target_hr_min", "target_hr_max", "structure", "status"] as const;

export async function updateWorkout(id: string, changes: Record<string, unknown>, reason: string): Promise<Result> {
  const { supabase, user } = await requireUser();
  if (!reason.trim()) return fail("Indica o motivo da alteração.");
  const { data: before } = await supabase.from("planned_workouts").select("*").eq("id", id).single();
  if (!before) return fail("Treino não encontrado.");
  const after: Record<string, unknown> = {};
  for (const k of WORKOUT_FIELDS) if (k in changes) after[k] = changes[k];
  if ("date" in after && !isISODate(after.date)) return fail("Data inválida.");
  const statusChange = "status" in after && Object.keys(after).length === 1;
  if (!statusChange && before.status === "planeado") after.status = "alterado";
  const { error } = await supabase.from("planned_workouts").update({ ...after, change_reason: reason.trim() }).eq("id", id);
  if (error) return fail(error.message);
  await supabase.from("planned_workout_changes").insert({ user_id: user.id, workout_id: id, reason: reason.trim(), before: Object.fromEntries(Object.keys(after).map((k) => [k, before[k]])), after });
  refresh();
  return { ok: true };
}

export async function addWorkout(input: Record<string, unknown>, reason: string): Promise<Result> {
  const { supabase, user } = await requireUser();
  if (!isISODate(input.date)) return fail("Data inválida.");
  const { data: plan } = await supabase.from("plans").select("id").order("created_at", { ascending: false }).limit(1).maybeSingle();
  const row: Record<string, unknown> = { user_id: user.id, plan_id: plan?.id ?? null, status: "planeado", change_reason: reason || "Adicionado" };
  for (const k of WORKOUT_FIELDS) if (k in input) row[k] = input[k];
  row.title ??= "Treino";
  row.type ??= "fácil";
  const { data, error } = await supabase.from("planned_workouts").insert(row).select("id").single();
  if (error) return fail(error.message);
  await supabase.from("planned_workout_changes").insert({ user_id: user.id, workout_id: data.id, reason: reason || "Adicionado", before: null, after: row });
  refresh();
  return { ok: true };
}

export async function deleteWorkout(id: string, reason: string): Promise<Result> {
  const { supabase, user } = await requireUser();
  const { data: before } = await supabase.from("planned_workouts").select("*").eq("id", id).single();
  if (!before) return fail("Treino não encontrado.");
  await supabase.from("planned_workout_changes").insert({ user_id: user.id, workout_id: null, reason: reason || "Removido", before, after: null });
  await supabase.from("planned_workouts").delete().eq("id", id);
  refresh();
  return { ok: true };
}

export async function saveStrengthExercise(id: string, fields: { sets?: string; reps?: string; load_kg?: string; notes?: string }): Promise<Result> {
  const { supabase } = await requireUser();
  const row: Record<string, unknown> = {};
  if (fields.sets !== undefined) row.sets = nOrNull(fields.sets);
  if (fields.reps !== undefined) row.reps = fields.reps;
  if (fields.load_kg !== undefined) row.load_kg = nOrNull(fields.load_kg);
  if (fields.notes !== undefined) row.notes = fields.notes;
  const { error } = await supabase.from("strength_exercises").update(row).eq("id", id);
  if (error) return fail(error.message);
  refresh();
  return { ok: true };
}

export async function saveRace(form: FormData): Promise<Result> {
  const { supabase, user } = await requireUser();
  const date = String(form.get("date") ?? "");
  if (!isISODate(date)) return fail("Data inválida.");
  const row = {
    user_id: user.id,
    name: String(form.get("name") ?? "").trim() || "Prova",
    date,
    distance_m: Math.round((nOrNull(form.get("distance_km")) ?? 10) * 1000),
    goal_time_s: parseDurationHms(String(form.get("goal") ?? "")),
    result_time_s: parseDurationHms(String(form.get("result") ?? "")),
    is_main: form.get("is_main") === "on",
  };
  const id = String(form.get("id") ?? "");
  const { error } = id ? await supabase.from("races").update(row).eq("id", id) : await supabase.from("races").insert(row);
  if (error) return fail(error.message);
  refresh();
  return { ok: true };
}

export async function deleteRace(id: string): Promise<Result> {
  const { supabase } = await requireUser();
  await supabase.from("races").delete().eq("id", id);
  refresh();
  return { ok: true };
}

// ------------------------------------------------------------------ treinador
export async function sendCoachMessage(message: string): Promise<Result<string>> {
  const { supabase, user } = await requireUser();
  if (!message.trim()) return fail("Mensagem vazia.");
  try {
    const r = await coachChat(supabase, user.id, message.trim().slice(0, 4000));
    refresh();
    return { ok: true, data: r.text };
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function clearCoachChat(): Promise<Result> {
  const { supabase } = await requireUser();
  await supabase.from("coach_messages").delete().eq("kind", "chat");
  refresh();
  return { ok: true };
}

export async function runWeeklyReview(weekStartDate?: string): Promise<Result> {
  const { supabase, user } = await requireUser();
  try {
    const r = await weeklyReview(supabase, user.id, weekStartDate && isISODate(weekStartDate) ? weekStartDate : undefined);
    refresh();
    return r.review ? { ok: true } : fail("A IA não gravou a revisão. Tenta outra vez.");
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function runRaceProjection(distanceM: number): Promise<Result<string>> {
  const { supabase, user } = await requireUser();
  try {
    const text = await raceProjection(supabase, user.id, distanceM);
    refresh();
    return { ok: true, data: text };
  } catch (e) {
    return fail((e as Error).message);
  }
}

interface ProposedChange {
  action: "update" | "add" | "remove";
  workout_id?: string;
  date?: string;
  type?: string;
  title?: string;
  distance_km?: number;
  target_pace_min_s?: number;
  target_pace_max_s?: number;
  target_hr_max?: number;
  structure_text?: string;
  reason: string;
}

/** Aceitar aplica as alterações propostas ao plano (com histórico); rejeitar só marca. */
export async function decideReview(id: string, accept: boolean): Promise<Result> {
  const { supabase } = await requireUser();
  const { data: review } = await supabase.from("weekly_reviews").select("*").eq("id", id).single();
  if (!review) return fail("Revisão não encontrada.");
  if (review.status !== "pendente") return fail("Esta revisão já foi decidida.");
  const errors: string[] = [];
  if (accept) {
    for (const c of (review.proposal ?? []) as ProposedChange[]) {
      const fields: Record<string, unknown> = {};
      for (const k of ["date", "type", "title", "distance_km", "target_pace_min_s", "target_pace_max_s", "target_hr_max"] as const) if (c[k] !== undefined) fields[k] = c[k];
      if (c.structure_text) fields.structure = [{ kind: "nota", description: c.structure_text }];
      const reason = `Revisão semanal: ${c.reason}`;
      const r = c.action === "update" && c.workout_id ? await updateWorkout(c.workout_id, fields, reason) : c.action === "add" ? await addWorkout(fields, reason) : c.action === "remove" && c.workout_id ? await deleteWorkout(c.workout_id, reason) : fail("Alteração incompleta.");
      if (!r.ok) errors.push(r.message);
    }
  }
  await supabase.from("weekly_reviews").update({ status: accept ? "aceite" : "rejeitada", decided_at: new Date().toISOString() }).eq("id", id);
  refresh();
  return errors.length ? fail(`Algumas alterações falharam: ${errors.join("; ")}`) : { ok: true };
}

// ------------------------------------------------------------------ definições
const PROFILE_NUM = [
  "age", "height_cm", "start_weight_kg", "goal_weight_kg", "easy_hr_max", "threshold_hr_min", "threshold_hr_max", "max_hr", "base_burn_kcal", "protein_target_g", "fiber_target_g",
  "rest_base_kcal", "rest_carbs_g", "rest_fat_g", "ratio_ref_kcal", "ratio_carbs_g", "ratio_fat_g", "exercise_factor",
];
const PROFILE_TIME = ["goal_10k_s", "goal_hm_s", "pb_hm_s"];
const PROFILE_PACE = ["pb_10k_pace_s", "easy_pace_min_s", "easy_pace_max_s"];

export async function saveProfile(form: FormData): Promise<Result> {
  const { supabase, user } = await requireUser();
  const row: Record<string, unknown> = { name: String(form.get("name") ?? "") };
  for (const k of PROFILE_NUM) if (form.has(k)) row[k] = nOrNull(form.get(k));
  for (const k of [...PROFILE_TIME, ...PROFILE_PACE]) if (form.has(k)) row[k] = parseDurationHms(String(form.get(k)));
  for (const k of ["start_date", "exercise_factor_start"]) if (form.has(k)) row[k] = isISODate(form.get(k)) ? form.get(k) : null;
  for (const k of ["base_burn_kcal", "protein_target_g", "fiber_target_g", "rest_base_kcal", "rest_carbs_g", "rest_fat_g", "ratio_ref_kcal", "ratio_carbs_g", "ratio_fat_g", "exercise_factor", "exercise_factor_start"])
    if (k in row && row[k] === null) return fail(`O campo ${k} é obrigatório.`);
  const { error } = await supabase.from("profile").update(row).eq("user_id", user.id);
  if (error) return fail(error.message);
  refresh();
  return { ok: true, message: "Guardado." };
}

export async function savePhase(form: FormData): Promise<Result> {
  const { supabase, user } = await requireUser();
  const start = String(form.get("start_date") ?? "");
  const end = String(form.get("end_date") ?? "");
  const base = nOrNull(form.get("base_kcal"));
  if (!base) return fail("Base kcal obrigatória.");
  const row = { user_id: user.id, start_date: isISODate(start) ? start : null, end_date: isISODate(end) ? end : null, base_kcal: base, note: String(form.get("note") ?? "").trim() || null };
  const id = String(form.get("id") ?? "");
  const { error } = id ? await supabase.from("calorie_phases").update(row).eq("id", id) : await supabase.from("calorie_phases").insert(row);
  if (error) return fail(error.message);
  refresh();
  return { ok: true };
}

export async function deletePhase(id: string): Promise<Result> {
  const { supabase } = await requireUser();
  await supabase.from("calorie_phases").delete().eq("id", id);
  refresh();
  return { ok: true };
}

export async function importSeedFile(form: FormData): Promise<Result<{ summary: string }>> {
  const { supabase, user } = await requireUser();
  const file = form.get("file");
  if (!(file instanceof File) || !file.size) return fail("Escolhe o ficheiro seed_entries.json.");
  let entries: SeedEntry[];
  try {
    entries = JSON.parse(await file.text());
    if (!Array.isArray(entries)) throw new Error("O ficheiro tem de ser uma lista.");
  } catch (e) {
    return fail(`JSON inválido: ${(e as Error).message}`);
  }
  try {
    const r = await importSeed(supabase, user.id, entries);
    const { verifyImport } = await import("@/lib/import/verify-db");
    const mismatches = await verifyImport(supabase, entries);
    refresh();
    const summary = `${r.days} dias, ${r.sleep} noites de sono, ${r.activities} atividades.` + (r.sleepInvalid.length ? ` Sono com fases que não somam o total: ${r.sleepInvalid.join(", ")}.` : "") + (r.warnings.length ? ` ${r.warnings.join(" ")}` : "");
    if (mismatches.length) return fail(`Importado, mas há ${mismatches.length} diferenças face ao ficheiro (ex.: ${mismatches.slice(0, 3).map((m) => `${m.date} ${m.field}: ficheiro ${m.file} / app ${m.app}`).join("; ")}).`);
    return { ok: true, data: { summary: `${summary} Verificação: sem diferenças face ao ficheiro.` } };
  } catch (e) {
    return fail((e as Error).message);
  }
}

/** Mostra os nomes dos campos de wellness que o Intervals.icu devolve para a tua conta (ex.: fases do sono). */
export async function probeWellness(): Promise<Result<string[]>> {
  await requireUser();
  const cfg = intervalsConfigFromEnv();
  if (!cfg) return fail("Intervals.icu não configurado.");
  try {
    const { probeWellnessFields } = await import("@/lib/integrations/intervals");
    return { ok: true, data: await probeWellnessFields(cfg, todayInTz()) };
  } catch (e) {
    return fail((e as Error).message);
  }
}

/** Define (ou muda) a password de entrada, para não depender de emails. */
export async function setPassword(form: FormData): Promise<Result> {
  const { supabase } = await requireUser();
  const p1 = String(form.get("password") ?? "");
  const p2 = String(form.get("password2") ?? "");
  if (p1.length < 8) return fail("A password tem de ter pelo menos 8 caracteres.");
  if (p1 !== p2) return fail("As duas passwords não são iguais.");
  const { error } = await supabase.auth.updateUser({ password: p1 });
  if (error) return fail(`Não foi possível guardar: ${error.message}`);
  return { ok: true, message: "Password guardada. A partir de agora entras com email + password." };
}

/** Envia um treino do plano para o Intervals.icu → Garmin (opcionalmente para outra data, ex.: teste hoje). */
export async function sendWorkoutToGarmin(workoutId: string, date?: string): Promise<Result<{ date: string; description: string }>> {
  const { supabase, user } = await requireUser();
  try {
    const { sendPlannedWorkout } = await import("@/lib/integrations/send-workout");
    const r = await sendPlannedWorkout(supabase, user.id, workoutId, date);
    return { ok: true, data: { date: r.date, description: r.description }, message: `Enviado para o Intervals.icu (${r.date}).` };
  } catch (e) {
    return fail((e as Error).message);
  }
}

/**
 * Treino de teste para descobrir que formato de ritmo o relógio Garmin mostra como alvo.
 * Cada passo (1 min) usa um formato diferente; o atleta diz quais mostram o ritmo no relógio.
 */
export async function sendPaceFormatTest(): Promise<Result> {
  await requireUser();
  const { intervalsConfigFromEnv, upsertWorkoutEvent } = await import("@/lib/integrations/intervals");
  const cfg = intervalsConfigFromEnv();
  if (!cfg) return fail("Intervals.icu não configurado.");
  const date = todayInTz();
  const description = [
    "- 1m 6:15-5:55/km Pace",
    "- 1m 5:55-6:15/km Pace",
    "- 1m 6:00/km Pace",
    "- 1m 75-80% Pace",
    "- 1m Z2 Pace",
    "- 0.5km 5:55-5:30/km Pace",
  ].join("\n");
  try {
    await upsertWorkoutEvent(cfg, { date, name: "TESTE ritmos (6 formatos)", description, externalId: `app-teste-ritmos-${date}` });
    return { ok: true, message: "Teste enviado para hoje. Sincroniza o relógio." };
  } catch (e) {
    return fail((e as Error).message);
  }
}
