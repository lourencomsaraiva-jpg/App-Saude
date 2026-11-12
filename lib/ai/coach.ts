/**
 * Treinador / nutricionista IA (API da Anthropic, modelo em ANTHROPIC_MODEL).
 * Ciclo manual de ferramentas: a IA consulta a base de dados através de COACH_TOOLS e nunca inventa números.
 */
import Anthropic from "@anthropic-ai/sdk";
import { todayInTz, weekdayLong } from "../calc/dates";
import { COACH_TOOLS, SUBMIT_REVIEW_TOOL, runCoachTool, type ToolContext } from "./coach-tools";

export const COACH_SYSTEM = `És o treinador de corrida e nutricionista pessoal de um atleta amador (39 anos, 1,80 m). Objetivos: 10 km abaixo de 40:00 e meia maratona abaixo de 1:30:00. Prova principal: Meia Maratona dos Descobrimentos (28/11/2026); depois GP de Natal Benfica 10 km (20/12/2026).

Como trabalhas:
- Escreves sempre em português europeu (Portugal): "treino", "pequeno-almoço", "telemóvel", "estás", nunca português do Brasil.
- Direto, sem conversa fiada, tom de treinador experiente. Nunca condescendente.
- Feedback honesto: não elogias tudo. Se um treino ou um dia correu mal, dizes o quê e porquê, com os números.
- Saúde primeiro: perante sinais de fadiga excessiva, dor, sono muito curto repetido, FC de repouso a subir ou VFC a cair, ou risco de lesão, recomendas recuar ou descansar, mesmo que isso atrase os objetivos.
- Nunca inventas números. Usas as ferramentas para ler os dados e citas-os (data e valor). Se um dado não existir, dizes que não existe.
- Não fazes contas de calorias, macros, saldo ou "Falta" de cabeça: usas os valores já calculados pelas ferramentas (get_days). Para somar alimentos de uma mensagem, usas os valores dos itens e indicas que é uma estimativa.
- Assumes explicitamente quando um valor é estimado ou assumido (peso de comida não confirmado, kcal estimadas, etc.).
- Não fazes previsões do peso do dia seguinte; o que conta são as médias semanais (get_weight_trend).
- Quando apresentas macros: tabela só com os alimentos da mensagem atual + linha "Total comido hoje" + linha "Falta" com os alvos no rótulo (ex.: "Falta (alvo 2680 kcal / 155 P / 368,6 H / 63,4 G / 30 F)"). Colunas: kcal, Prot, Hidr, Gord, Fibra.
- Ritmos em min:ss/km; tempos em h:mm:ss. Datas como dd/mm.
- Respostas curtas e estruturadas (markdown), salvo quando pedem detalhe.`;

const MODES = {
  chat: { effort: "medium" as const, maxTokens: 16000 },
  analysis: { effort: "low" as const, maxTokens: 8000 },
  review: { effort: "high" as const, maxTokens: 32000 },
  projection: { effort: "high" as const, maxTokens: 16000 },
};
export type CoachMode = keyof typeof MODES;

/** Modelos que aceitam o fallback do lado do servidor em caso de recusa. */
function supportsFallback(model: string) {
  return /^claude-(opus-5|sonnet-5-5|fable-5)/.test(model);
}

export interface CoachRunResult {
  text: string;
  review?: { review_md: string; changes: unknown[] };
  toolCalls: string[];
}

export async function runCoach(params: { ctx: ToolContext; mode: CoachMode; history: Anthropic.Beta.BetaMessageParam[]; userMessage: string }): Promise<CoachRunResult> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("Falta ANTHROPIC_API_KEY (Vercel → Settings → Environment Variables).");
  const client = new Anthropic();
  const model = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";
  const cfg = MODES[params.mode];
  const tools = params.mode === "review" ? [...COACH_TOOLS, SUBMIT_REVIEW_TOOL] : COACH_TOOLS;
  const today = todayInTz();
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    ...params.history,
    { role: "user", content: `[Hoje: ${weekdayLong(today)}, ${today}]\n\n${params.userMessage}` },
  ];
  const toolCalls: string[] = [];
  let review: CoachRunResult["review"];

  for (let turn = 0; turn < 12; turn++) {
    const res = await client.beta.messages.create({
      model,
      max_tokens: cfg.maxTokens,
      system: [{ type: "text", text: COACH_SYSTEM, cache_control: { type: "ephemeral" } }],
      tools: tools as Anthropic.Beta.BetaTool[],
      messages,
      output_config: { effort: cfg.effort },
      ...(supportsFallback(model) ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
    });

    if (res.stop_reason === "refusal") return { text: "Não consegui responder a este pedido. Reformula, por favor.", toolCalls };
    messages.push({ role: "assistant", content: res.content as Anthropic.Beta.BetaContentBlockParam[] });

    const toolUses = res.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
    if (res.stop_reason === "pause_turn") continue;
    if (res.stop_reason !== "tool_use" || toolUses.length === 0) {
      const text = res.content
        .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      return { text: text || (review ? review.review_md : ""), review, toolCalls };
    }

    const results: Anthropic.Beta.BetaToolResultBlockParam[] = await Promise.all(
      toolUses.map(async (tu) => {
        toolCalls.push(tu.name);
        try {
          if (tu.name === SUBMIT_REVIEW_TOOL.name) {
            const input = tu.input as { review_md?: string; changes?: unknown[] };
            if (typeof input.review_md !== "string" || !Array.isArray(input.changes)) throw new Error("review_md e changes são obrigatórios");
            review = { review_md: input.review_md, changes: input.changes };
            return { type: "tool_result" as const, tool_use_id: tu.id, content: "Revisão gravada. Aguarda decisão do atleta." };
          }
          const out = await runCoachTool(tu.name, (tu.input ?? {}) as Record<string, unknown>, params.ctx);
          return { type: "tool_result" as const, tool_use_id: tu.id, content: JSON.stringify(out) };
        } catch (e) {
          return { type: "tool_result" as const, tool_use_id: tu.id, content: `Erro: ${(e as Error).message}`, is_error: true };
        }
      }),
    );
    messages.push({ role: "user", content: results });
  }
  return { text: "A análise ficou demasiado longa. Tenta uma pergunta mais concreta.", review, toolCalls };
}
