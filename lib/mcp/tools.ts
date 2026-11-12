/**
 * Ferramentas expostas ao Claude (conector MCP): leitura (as mesmas do treinador) + escrita.
 * Todas as contas passam por lib/calc; cada escrita devolve o resumo do dia recalculado.
 */
import { COACH_TOOLS, runCoachTool } from "../ai/coach-tools";
import { isISODate, todayInTz } from "../calc/dates";
import { parseDecimal, round1 } from "../calc/numbers";
import { checkKcalConsistency } from "../calc/nutrition";
import { parseSleepText, validateSleep } from "../calc/sleep";
import { loadDays } from "../data/days";
import { loadSettings } from "../data/settings";
import { MEAL_LABELS, type DB, type MealLabel } from "../types";

type Json = Record<string, unknown>;
interface ToolDef {
  name: string;
  description: string;
  inputSchema: Json;
  readOnly?: boolean;
}

const n = (v: unknown) => (v === null || v === undefined || v === "" ? null : parseDecimal(String(v)));

const itemSchema = {
  type: "object",
  properties: {
    description: { type: "string", description: "Alimento e quantidade, ex.: 'Arroz branco cozido 200 g'" },
    quantity: { type: "number" },
    unit: { type: "string", description: "g, ml, un., dose" },
    kcal: { type: "number" },
    protein_g: { type: "number" },
    carbs_g: { type: "number" },
    fat_g: { type: "number" },
    fiber_g: { type: "number" },
    weight_confirmed: { type: "boolean", description: "true se o atleta indicou/pesou a quantidade; false se foi assumida" },
  },
  required: ["description", "kcal", "protein_g", "carbs_g", "fat_g", "fiber_g", "weight_confirmed"],
};

export const WRITE_TOOLS: ToolDef[] = [
  {
    name: "search_foods",
    description: "Procura na tabela pessoal de alimentos (valores por dose) e nas refeições favoritas/receitas. Usa estes valores sempre que o alimento existir.",
    inputSchema: { type: "object", properties: { query: { type: "string" } } },
    readOnly: true,
  },
  {
    name: "add_food",
    description:
      "Regista alimentos numa refeição. Valores para a quantidade comida (não por 100 g). Devolve o resumo do dia já calculado pela app (comido, alvo, Falta, saldo) — usa ESSES números na resposta, não faças contas.",
    inputSchema: {
      type: "object",
      properties: {
        date: { type: "string", description: "YYYY-MM-DD (por omissão hoje)" },
        meal: { type: "string", enum: MEAL_LABELS },
        items: { type: "array", items: itemSchema, minItems: 1 },
      },
      required: ["meal", "items"],
    },
  },
  {
    name: "delete_food_item",
    description: "Apaga um item de comida (id obtido com get_meals).",
    inputSchema: { type: "object", properties: { item_id: { type: "string" } }, required: ["item_id"] },
  },
  {
    name: "set_weight",
    description: "Regista o peso do dia (kg). Fica como valor manual (o Garmin não o substitui).",
    inputSchema: { type: "object", properties: { date: { type: "string" }, weight_kg: { type: "number" } }, required: ["weight_kg"] },
  },
  {
    name: "set_sleep",
    description:
      "Regista o sono. day_date segue a convenção do histórico: a noite que acaba na manhã de X fica no dia X−1. text no formato '7:35 (profundo 1:37, leve 4:49, REM 1:09, acordado 27min)'. Profundo+leve+REM tem de dar o total.",
    inputSchema: { type: "object", properties: { day_date: { type: "string" }, text: { type: "string" }, score: { type: "number" } }, required: ["day_date", "text"] },
  },
  {
    name: "add_day_note",
    description: "Acrescenta texto às notas do dia (não apaga as anteriores).",
    inputSchema: { type: "object", properties: { date: { type: "string" }, note: { type: "string" } }, required: ["note"] },
  },
  {
    name: "update_planned_workout",
    description: "Altera ou move um treino planeado (id de get_plan). Motivo obrigatório; fica no histórico de alterações. Só usar depois de o atleta concordar.",
    inputSchema: {
      type: "object",
      properties: {
        workout_id: { type: "string" },
        reason: { type: "string" },
        date: { type: "string" },
        type: { type: "string", enum: ["descanso", "fácil", "qualidade", "longo", "força", "prova", "recuperação"] },
        title: { type: "string" },
        distance_km: { type: "number" },
        target_pace_min_s: { type: "number", description: "segundos por km" },
        target_pace_max_s: { type: "number" },
        target_hr_max: { type: "number" },
        structure_text: { type: "string", description: "Estrutura, uma linha por passo" },
        status: { type: "string", enum: ["planeado", "feito", "falhado", "alterado"] },
      },
      required: ["workout_id", "reason"],
    },
  },
];

export function listTools() {
  const reads = COACH_TOOLS.map((t) => ({ name: t.name, description: t.description ?? "", inputSchema: t.input_schema as Json, annotations: { readOnlyHint: true } }));
  const writes = WRITE_TOOLS.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema, annotations: { readOnlyHint: !!t.readOnly } }));
  return [...reads, ...writes];
}

async function daySummary(db: DB, userId: string, date: string) {
  const settings = await loadSettings(db, userId);
  const [d] = await loadDays(db, date, date, settings, false, userId);
  const s = d.summary;
  return { date, eaten: s.eaten, target: s.target, remaining: s.remaining, balance_kcal: s.balance_kcal, exercise_kcal_adjusted: s.exercise_kcal_adj };
}

export async function callTool(db: DB, userId: string, name: string, args: Json): Promise<unknown> {
  if (COACH_TOOLS.some((t) => t.name === name)) return runCoachTool(name, args, { db, userId });
  const date = isISODate(args.date) ? args.date : todayInTz();

  switch (name) {
    case "search_foods": {
      const q = String(args.query ?? "").trim();
      let fq = db.from("foods").select("id, name, serving, serving_g, kcal, protein_g, carbs_g, fat_g, fiber_g, is_favorite").eq("user_id", userId).order("name");
      if (q) fq = fq.ilike("name", `%${q}%`);
      const [{ data: foods }, { data: recipes }] = await Promise.all([fq.limit(40), db.from("recipes").select("name, kind, portions, recipe_items(description, kcal, protein_g, carbs_g, fat_g, fiber_g)").eq("user_id", userId)]);
      return { foods, favorite_meals_and_recipes: recipes };
    }
    case "add_food": {
      const meal = (MEAL_LABELS.includes(args.meal as MealLabel) ? args.meal : "extra") as MealLabel;
      const items = Array.isArray(args.items) ? (args.items as Json[]) : [];
      if (!items.length) return { error: "Sem itens." };
      const { data: m, error } = await db.from("meals").insert({ user_id: userId, date, label: meal }).select("id").single();
      if (error || !m) return { error: error?.message ?? "Erro ao criar refeição" };
      const rows = items.map((i, position) => {
        const v = { kcal: round1(n(i.kcal) ?? 0), protein_g: n(i.protein_g), carbs_g: n(i.carbs_g), fat_g: n(i.fat_g), fiber_g: n(i.fiber_g) };
        const check = checkKcalConsistency(v);
        return {
          user_id: userId,
          meal_id: m.id,
          position,
          description: String(i.description ?? "Alimento"),
          quantity: n(i.quantity),
          unit: i.unit ? String(i.unit) : null,
          kcal: v.kcal,
          protein_g: v.protein_g === null ? null : round1(v.protein_g),
          carbs_g: v.carbs_g === null ? null : round1(v.carbs_g),
          fat_g: v.fat_g === null ? null : round1(v.fat_g),
          fiber_g: v.fiber_g === null ? null : round1(v.fiber_g),
          weight_confirmed: i.weight_confirmed === true,
          source: "ai_text",
          needs_review: !check.ok,
        };
      });
      const { error: ie } = await db.from("meal_items").insert(rows);
      if (ie) return { error: ie.message };
      return {
        saved: rows.map((r) => ({ description: r.description, kcal: r.kcal, needs_review: r.needs_review })),
        day: await daySummary(db, userId, date),
      };
    }
    case "delete_food_item": {
      const { data: item } = await db.from("meal_items").select("meal_id, meals(date)").eq("id", String(args.item_id)).eq("user_id", userId).maybeSingle();
      if (!item) return { error: "Item não encontrado" };
      await db.from("meal_items").delete().eq("id", String(args.item_id)).eq("user_id", userId);
      const { count } = await db.from("meal_items").select("id", { count: "exact", head: true }).eq("meal_id", item.meal_id);
      if (!count) await db.from("meals").delete().eq("id", item.meal_id);
      const d = (item as unknown as { meals: { date: string } | null }).meals?.date ?? date;
      return { deleted: true, day: await daySummary(db, userId, d) };
    }
    case "set_weight": {
      const kg = n(args.weight_kg);
      if (kg === null || kg < 30 || kg > 250) return { error: "Peso inválido" };
      const { error } = await db.from("days").upsert({ user_id: userId, date, weight_kg: round1(kg), weight_source: "manual" }, { onConflict: "user_id,date" });
      return error ? { error: error.message } : { saved: true, date, weight_kg: round1(kg) };
    }
    case "set_sleep": {
      if (!isISODate(args.day_date)) return { error: "day_date inválida" };
      const parsed = parseSleepText(String(args.text ?? ""));
      if (!parsed) return { error: "Formato não reconhecido" };
      const v = validateSleep(parsed);
      if (!v.ok) return { error: v.message };
      const { error } = await db.from("sleep").upsert({ user_id: userId, day_date: args.day_date, ...parsed, score: n(args.score), source: "manual" }, { onConflict: "user_id,day_date" });
      return error ? { error: error.message } : { saved: true, ...parsed };
    }
    case "add_day_note": {
      const { data: d } = await db.from("days").select("notes").eq("user_id", userId).eq("date", date).maybeSingle();
      const notes = [d?.notes, String(args.note ?? "").trim()].filter(Boolean).join("\n");
      const { error } = await db.from("days").upsert({ user_id: userId, date, notes }, { onConflict: "user_id,date" });
      return error ? { error: error.message } : { saved: true };
    }
    case "update_planned_workout": {
      const id = String(args.workout_id ?? "");
      const reason = String(args.reason ?? "").trim();
      if (!reason) return { error: "Motivo obrigatório" };
      const { data: before } = await db.from("planned_workouts").select("*").eq("id", id).eq("user_id", userId).maybeSingle();
      if (!before) return { error: "Treino não encontrado" };
      const after: Json = {};
      for (const k of ["date", "type", "title", "distance_km", "target_pace_min_s", "target_pace_max_s", "target_hr_max", "status"]) if (args[k] !== undefined) after[k] = args[k];
      if (args.structure_text) after.structure = String(args.structure_text).split("\n").map((s) => s.trim()).filter(Boolean).map((description) => ({ kind: "nota", description }));
      if ("date" in after && !isISODate(after.date)) return { error: "Data inválida" };
      if (!("status" in after) && before.status === "planeado") after.status = "alterado";
      const { error } = await db.from("planned_workouts").update({ ...after, change_reason: reason }).eq("id", id).eq("user_id", userId);
      if (error) return { error: error.message };
      await db.from("planned_workout_changes").insert({ user_id: userId, workout_id: id, reason, before: Object.fromEntries(Object.keys(after).map((k) => [k, before[k]])), after });
      return { saved: true, changes: after };
    }
    default:
      return { error: `Ferramenta desconhecida: ${name}` };
  }
}
