/** Sincronização pedida pelo utilizador (botão, abrir a app, histórico). Partilhada pela rota /api/sync. */
import { analyzeActivity } from "../ai/coach-actions";
import { addDays, todayInTz } from "../calc/dates";
import { intervalsConfigFromEnv } from "../integrations/intervals";
import type { DB } from "../types";
import { syncIntervals } from "./intervals-sync";

export async function runUserSync(db: DB, userId: string, trigger: "manual" | "open", backfillDays?: number) {
  const cfg = intervalsConfigFromEnv();
  if (!cfg) return { ok: false, imported: 0, errors: ["Intervals.icu não configurado (INTERVALS_ATHLETE_ID e INTERVALS_API_KEY na Vercel)."], skipped: false };
  if (trigger === "open") {
    const { data: last } = await db.from("sync_log").select("started_at").eq("source", "intervals").order("started_at", { ascending: false }).limit(1).maybeSingle();
    if (last && Date.now() - new Date(last.started_at).getTime() < 20 * 60_000) return { ok: true, imported: 0, errors: [], skipped: true };
  }
  const oldest = backfillDays ? addDays(todayInTz(), -Math.min(backfillDays, 400)) : undefined;
  const res = await syncIntervals(db, userId, cfg, { trigger, oldest, detailLimit: backfillDays ? 8 : 4 });
  if (process.env.ANTHROPIC_API_KEY && res.newActivityIds.length) {
    const { data: runs } = await db.from("activities").select("id").in("id", res.newActivityIds).eq("type", "corrida").is("ai_analysis", null).limit(2);
    for (const r of runs ?? []) await analyzeActivity(db, userId, r.id).catch(() => {});
  }
  return { ok: res.ok, imported: res.imported, errors: res.errors, skipped: false };
}
