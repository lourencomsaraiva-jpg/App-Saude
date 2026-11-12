/**
 * Estimativa nutricional de refeições a partir de foto ou texto livre.
 * Por omissão usa o Gemini (FOOD_AI_PROVIDER=gemini); alternativa: Anthropic.
 * A IA só estima quantidades e valores por alimento; as somas e validações são feitas por lib/calc.
 */
import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { ApiError, GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { round1 } from "../calc/numbers";
import { checkKcalConsistency } from "../calc/nutrition";
import type { FoodRow } from "../types";

export const FoodEstimateSchema = z.object({
  items: z.array(
    z.object({
      description: z.string().describe("Nome do alimento em português europeu, com a preparação (ex.: 'arroz branco cozido')."),
      quantity: z.number().nullable().describe("Quantidade estimada (gramas ou ml; ou unidades se unit = 'un.')."),
      unit: z.string().describe("'g', 'ml' ou 'un.'"),
      kcal: z.number(),
      protein_g: z.number(),
      carbs_g: z.number(),
      fat_g: z.number(),
      fiber_g: z.number(),
      weight_assumed: z.boolean().describe("true se a quantidade foi estimada/assumida; false se o utilizador a indicou."),
    }),
  ),
  comment: z.string().describe("Uma frase curta com pressupostos relevantes (ex.: azeite assumido)."),
});
export type FoodEstimate = z.infer<typeof FoodEstimateSchema>;

export interface EstimatedItem {
  description: string;
  quantity: number | null;
  unit: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  weight_confirmed: boolean;
  needs_review: boolean;
  check_expected_kcal: number;
}

function systemPrompt(foods: Pick<FoodRow, "name" | "serving" | "kcal" | "protein_g" | "carbs_g" | "fat_g" | "fiber_g">[]) {
  const table = foods.map((f) => `- ${f.name} (${f.serving}): ${f.kcal} kcal, P ${f.protein_g}, H ${f.carbs_g}, G ${f.fat_g}, F ${f.fiber_g}`).join("\n");
  return `És um nutricionista. Estimas a composição nutricional de refeições em Portugal.
Responde só com o JSON pedido, em português europeu.
Regras:
- Um item por alimento visível ou mencionado (inclui molhos, azeite de confeção e bebidas calóricas se forem prováveis; indica-o no comentário).
- Quando o utilizador indicar a quantidade, usa-a e marca weight_assumed = false. Caso contrário estima a porção e marca weight_assumed = true.
- Valores para a quantidade indicada (não por 100 g). kcal coerentes com 4×P + 4×H + 9×G.
- Se o alimento existir nesta tabela pessoal, usa estes valores (escalados à quantidade):
${table}`;
}

function postProcess(est: FoodEstimate): EstimatedItem[] {
  return est.items.map((i) => {
    const item = {
      description: i.description.trim(),
      quantity: i.quantity === null ? null : round1(i.quantity),
      unit: i.unit || "g",
      kcal: round1(i.kcal),
      protein_g: round1(i.protein_g),
      carbs_g: round1(i.carbs_g),
      fat_g: round1(i.fat_g),
      fiber_g: round1(i.fiber_g),
    };
    const check = checkKcalConsistency(item);
    return { ...item, weight_confirmed: !i.weight_assumed, needs_review: !check.ok, check_expected_kcal: check.expectedKcal };
  });
}

function provider(): "gemini" | "anthropic" {
  const p = (process.env.FOOD_AI_PROVIDER || "gemini").toLowerCase();
  return p === "anthropic" ? "anthropic" : "gemini";
}

/** Modelos a tentar, por ordem: GEMINI_MODEL, depois GEMINI_FALLBACK_MODELS (separados por vírgulas). */
function geminiModels(): string[] {
  const main = process.env.GEMINI_MODEL?.trim() || "gemini-3.8-flash";
  const fallbacks = (process.env.GEMINI_FALLBACK_MODELS ?? "gemini-flash-latest,gemini-flash-lite-latest")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  return [...new Set([main, ...fallbacks])];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function viaGemini(parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }>, system: string): Promise<FoodEstimate> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Falta GEMINI_API_KEY (Vercel → Settings → Environment Variables).");
  const ai = new GoogleGenAI({ apiKey });
  let lastStatus = 0;
  // Sobrecarga (503/500) ou limite (429): repete com espera e depois passa ao modelo seguinte.
  for (const model of geminiModels()) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await ai.models.generateContent({
          model,
          contents: [{ role: "user", parts }],
          config: {
            systemInstruction: system,
            responseMimeType: "application/json",
            responseJsonSchema: z.toJSONSchema(FoodEstimateSchema),
            temperature: 0.2,
          },
        });
        const text = res.text;
        if (!text) throw new Error("O Gemini não devolveu resposta.");
        return FoodEstimateSchema.parse(JSON.parse(text));
      } catch (e) {
        const status = e instanceof ApiError ? e.status : 0;
        lastStatus = status;
        if (status === 400 || status === 401 || status === 403) throw new Error("A chave do Gemini foi recusada. Verifica GEMINI_API_KEY na Vercel.");
        if (status === 404) break; // modelo não existe nesta conta: passa ao seguinte
        if (status === 429 || status >= 500) {
          if (attempt === 0) await sleep(1500);
          continue;
        }
        throw new Error("A estimativa veio num formato inválido. Tenta outra vez ou introduz à mão.");
      }
    }
  }
  throw new Error(
    lastStatus === 429
      ? "Atingiste o limite gratuito do Gemini por agora. Tenta daqui a um minuto ou introduz à mão."
      : "O Gemini está sobrecarregado neste momento. Tenta daqui a pouco ou introduz à mão.",
  );
}

async function viaAnthropic(content: Anthropic.ContentBlockParam[], system: string): Promise<FoodEstimate> {
  const client = new Anthropic();
  const res = await client.messages.parse({
    model: process.env.ANTHROPIC_MODEL || "claude-opus-5-5",
    max_tokens: 8000,
    output_config: { effort: "low", format: zodOutputFormat(FoodEstimateSchema) },
    system,
    messages: [{ role: "user", content }],
  });
  if (!res.parsed_output) throw new Error("A IA não devolveu uma estimativa válida.");
  return res.parsed_output;
}

type FoodsForPrompt = Parameters<typeof systemPrompt>[0];

export async function estimateFromText(text: string, foods: FoodsForPrompt): Promise<{ items: EstimatedItem[]; comment: string }> {
  const sys = systemPrompt(foods);
  const prompt = `Refeição: ${text}`;
  const est = provider() === "gemini" ? await viaGemini([{ text: prompt }], sys) : await viaAnthropic([{ type: "text", text: prompt }], sys);
  return { items: postProcess(est), comment: est.comment };
}

export async function estimateFromPhoto(base64: string, mimeType: string, hint: string, foods: FoodsForPrompt): Promise<{ items: EstimatedItem[]; comment: string }> {
  const sys = systemPrompt(foods);
  const prompt = `Estima os alimentos e porções desta fotografia de uma refeição.${hint ? ` Indicação do utilizador: ${hint}` : ""}`;
  // As fotos vão sempre para o Gemini, a não ser que FOOD_AI_PROVIDER=anthropic.
  const est =
    provider() === "gemini"
      ? await viaGemini([{ inlineData: { mimeType, data: base64 } }, { text: prompt }], sys)
      : await viaAnthropic(
          [
            { type: "image", source: { type: "base64", media_type: mimeType as "image/jpeg", data: base64 } },
            { type: "text", text: prompt },
          ],
          sys,
        );
  return { items: postProcess(est), comment: est.comment };
}
