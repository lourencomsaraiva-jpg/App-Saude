/**
 * Ações de alto nível do treinador: chat, análise de treino, revisão semanal, projeção de prova.
 * Não importa "server-only" para poder correr no cron com o cliente admin.
 */
import type Anthropic from "@anthropic-ai/sdk";
import { addDays, formatDatePt, todayInTz, weekStart } from "../calc/dates";
import type { DB } from "../types";
import { runCoach } from "./coach";

export async function coachChat(db: DB, userId: string, message: string) {
  const { data: recent } = await db.from("coach_messages").select("role, content").eq("user_id", userId).eq("kind", "chat").order("created_at", { ascending: false }).limit(16);
  const history: Anthropic.Beta.BetaMessageParam[] = ((recent ?? []) as Array<{ role: "user" | "assistant"; content: string }>).reverse().map((m) => ({ role: m.role, content: m.content }));
  // a conversa tem de alternar e começar no utilizador
  while (history.length && history[0].role !== "user") history.shift();
  if (history.length && history[history.length - 1].role === "user") history.pop();
  const res = await runCoach({ ctx: { db, userId }, mode: "chat", history, userMessage: message });
  await db.from("coach_messages").insert([
    { user_id: userId, role: "user", kind: "chat", content: message },
    { user_id: userId, role: "assistant", kind: "chat", content: res.text },
  ]);
  return res;
}

export async function analyzeActivity(db: DB, userId: string, activityId: string) {
  const res = await runCoach({
    ctx: { db, userId },
    mode: "analysis",
    history: [],
    userMessage: `Faz uma análise curta (máx. 120 palavras) do treino com id ${activityId}. Usa get_activity_detail e, se útil, get_plan do mesmo dia e get_activities das últimas 3 semanas para comparar com treinos semelhantes. Compara com o alvo do plano (ritmo, FC, distância), comenta o custo cardíaco e diz claramente o que correu bem e mal. Sem cumprimentos.`,
  });
  await db.from("activities").update({ ai_analysis: res.text }).eq("id", activityId).eq("user_id", userId);
  return res.text;
}

export async function weeklyReview(db: DB, userId: string, ws?: string) {
  const today = todayInTz();
  const weekStartDate = ws ?? weekStart(today);
  const weekEnd = addDays(weekStartDate, 6);
  const nextStart = addDays(weekStartDate, 7);
  const nextEnd = addDays(weekStartDate, 13);
  const res = await runCoach({
    ctx: { db, userId },
    mode: "review",
    history: [],
    userMessage: `Revisão semanal da semana ${formatDatePt(weekStartDate)}–${formatDatePt(weekEnd)}.
1. Lê get_days (com notas), get_activities, get_plan dessa semana, get_weight_trend das últimas 4 semanas e get_profile_and_targets.
2. Avalia: cumprimento do plano (feito vs planeado), volume (km), qualidade das sessões-chave, sono médio, peso médio e Δ, nutrição (kcal médias vs alvo, dias com proteína no alvo, fibra).
3. Lê get_plan de ${formatDatePt(nextStart)} a ${formatDatePt(nextEnd)} e propõe ajustes concretos (ou nenhum, se o plano estiver certo). Saúde primeiro.
4. Chama submit_weekly_review com a revisão em markdown e a lista de alterações (cada uma com motivo). Depois responde com um resumo de 3 linhas.`,
  });
  if (res.review) {
    await db.from("weekly_reviews").upsert(
      { user_id: userId, week_start: weekStartDate, review_md: res.review.review_md, proposal: res.review.changes, status: "pendente", decided_at: null },
      { onConflict: "user_id,week_start" },
    );
  }
  await db.from("coach_messages").insert({ user_id: userId, role: "assistant", kind: "review", content: res.review?.review_md ?? res.text });
  return res;
}

export async function raceProjection(db: DB, userId: string, distanceM: number) {
  const label = distanceM >= 20000 ? "meia maratona" : "10 km";
  const res = await runCoach({
    ctx: { db, userId },
    mode: "projection",
    history: [],
    userMessage: `Projeção de prova para ${label} (${distanceM} m). Usa get_race_projection_inputs e get_days/get_activities das últimas 4 semanas para avaliar o contexto (sono, fadiga, volume). Dá sempre um intervalo (não um número único), a estimativa central, o ritmo por km correspondente e os pressupostos (condições, afinamento, percurso). Compara com o objetivo. Máx. 200 palavras.`,
  });
  await db.from("coach_messages").insert({ user_id: userId, role: "assistant", kind: "projection", content: res.text });
  return res.text;
}
