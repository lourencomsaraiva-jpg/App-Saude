/**
 * Primeira entrada: cria perfil, fases, alimentos padrão, favoritos, provas, plano de força e plano de treino.
 * Idempotente: só cria o que falta. Usa o cliente do utilizador (RLS) ou o admin com userId explícito.
 */
import { scaleNutrients } from "../calc/nutrition";
import { DEFAULT_FAVORITE_MEALS, DEFAULT_FOODS, DEFAULT_PHASES, DEFAULT_PROFILE, DEFAULT_RACES, DEFAULT_STRENGTH } from "../defaults";
import { buildAthletePlan } from "../plan/athlete-plan";
import type { DB } from "../types";

const readyUsers = new Set<string>();

export async function ensureSetup(db: DB, userId: string): Promise<{ created: boolean }> {
  if (readyUsers.has(userId)) return { created: false };
  const { data: existing, error } = await db.from("profile").select("id").eq("user_id", userId).maybeSingle();
  if (error) throw new Error(`Perfil: ${error.message}`);
  if (existing) {
    readyUsers.add(userId);
    return { created: false };
  }

  const must = async <T>(p: PromiseLike<{ data: T; error: { message: string } | null }>, what: string): Promise<T> => {
    const r = await p;
    if (r.error) throw new Error(`${what}: ${r.error.message}`);
    return r.data;
  };

  await must(db.from("profile").insert({ ...DEFAULT_PROFILE, user_id: userId }), "Perfil");
  await must(db.from("calorie_phases").insert(DEFAULT_PHASES.map((p) => ({ ...p, user_id: userId }))), "Fases");

  const foods = await must(
    db
      .from("foods")
      .upsert(
        DEFAULT_FOODS.map(({ favorite, ...f }) => ({ ...f, is_favorite: !!favorite, user_id: userId })),
        { onConflict: "user_id,name" },
      )
      .select("id, name, kcal, protein_g, carbs_g, fat_g, fiber_g, serving"),
    "Alimentos",
  );
  const foodByName = new Map((foods ?? []).map((f: { name: string }) => [f.name, f]));

  for (const fav of DEFAULT_FAVORITE_MEALS) {
    const recipe = await must(
      db.from("recipes").upsert({ user_id: userId, name: fav.name, kind: "favorite_meal", portions: 1, default_label: fav.label }, { onConflict: "user_id,name" }).select("id").single(),
      "Favorito",
    );
    const items = fav.items.map(([foodName, mult, description], position) => {
      const f = foodByName.get(foodName) as unknown as { id: string; kcal: number; protein_g: number; carbs_g: number; fat_g: number; fiber_g: number; serving: string };
      const scaled = scaleNutrients({ kcal: f.kcal, protein_g: f.protein_g, carbs_g: f.carbs_g, fat_g: f.fat_g, fiber_g: f.fiber_g }, mult);
      return { user_id: userId, recipe_id: (recipe as { id: string }).id, food_id: f.id, position, description, quantity: mult, unit: `× ${f.serving}`, ...scaled };
    });
    await must(db.from("recipe_items").insert(items), "Itens do favorito");
  }

  const races = await must(db.from("races").insert(DEFAULT_RACES.map((r) => ({ ...r, user_id: userId }))).select("id, name, is_main"), "Provas");

  const sessionIdByDay = new Map<number, string>();
  for (const s of DEFAULT_STRENGTH) {
    const session = await must(db.from("strength_sessions").insert({ user_id: userId, name: s.name, day_of_week: s.day_of_week, notes: s.notes }).select("id").single(), "Força");
    sessionIdByDay.set(s.day_of_week, (session as { id: string }).id);
    await must(
      db.from("strength_exercises").insert(
        s.exercises.map((e, position) => ({ user_id: userId, session_id: (session as { id: string }).id, position, name: e.name, zone: e.zone, sets: e.sets, reps: e.reps, load_range: e.load_range, load_kg: null, superset: e.superset, notes: e.notes })),
      ),
      "Exercícios de força",
    );
  }

  const mainRace = (races as Array<{ id: string; is_main: boolean }>).find((r) => r.is_main);
  const workouts = buildAthletePlan();
  const plan = await must(
    db.from("plans").insert({ user_id: userId, name: "Plano de Treino (Ajustado) Ago–Dez 2026", race_id: mainRace?.id ?? null, start_date: workouts[0].date, end_date: workouts[workouts.length - 1].date }).select("id").single(),
    "Plano",
  );
  await must(
    db.from("planned_workouts").insert(
      workouts.map(({ strength_day, ...w }) => ({
        ...w,
        user_id: userId,
        plan_id: (plan as { id: string }).id,
        strength_session_id: strength_day !== undefined ? sessionIdByDay.get(strength_day) ?? null : null,
      })),
    ),
    "Treinos planeados",
  );
  readyUsers.add(userId);
  return { created: true };
}
