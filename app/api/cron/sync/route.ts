import { NextResponse, type NextRequest } from "next/server";
import { analyzeActivity, weeklyReview } from "@/lib/ai/coach-actions";
import { hourInTz, todayInTz, weekStart, weekdayMon0 } from "@/lib/calc/dates";
import { intervalsConfigFromEnv } from "@/lib/integrations/intervals";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncIntervals } from "@/lib/sync/intervals-sync";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

/**
 * Cron de hora a hora (Supabase pg_cron → POST, ou Vercel Cron → GET), protegido por CRON_SECRET.
 * 1) sincroniza o Intervals.icu; 2) analisa treinos de corrida novos; 3) domingo ≥ 20h: revisão semanal.
 */
async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const db = createAdminClient();
  const allowed = process.env.ALLOWED_EMAIL?.toLowerCase();
  const { data: profiles } = await db.from("profile").select("user_id");
  const users: string[] = [];
  for (const p of profiles ?? []) {
    const { data } = await db.auth.admin.getUserById(p.user_id);
    if (data.user?.email?.toLowerCase() === allowed) users.push(p.user_id);
  }
  if (!users.length) return NextResponse.json({ ok: false, error: "Utilizador não encontrado (faz login uma vez na app)." });

  const cfg = intervalsConfigFromEnv();
  const tz = process.env.APP_TIMEZONE || "Europe/Lisbon";
  const out: Record<string, unknown> = {};
  for (const userId of users) {
    const res: Record<string, unknown> = {};
    if (cfg) {
      const s = await syncIntervals(db, userId, cfg, { trigger: "cron" });
      res.sync = { ok: s.ok, imported: s.imported, errors: s.errors.length };
      if (process.env.ANTHROPIC_API_KEY && s.newActivityIds.length) {
        const { data: runs } = await db.from("activities").select("id").eq("user_id", userId).in("id", s.newActivityIds).eq("type", "corrida").is("ai_analysis", null).limit(2);
        for (const r of runs ?? []) await analyzeActivity(db, userId, r.id).catch((e) => (res.analysisError = String(e)));
      }
    }
    const today = todayInTz();
    if (process.env.ANTHROPIC_API_KEY && weekdayMon0(today) === 6 && hourInTz(new Date(), tz) >= 20) {
      const ws = weekStart(today);
      const { data: existing } = await db.from("weekly_reviews").select("id").eq("user_id", userId).eq("week_start", ws).maybeSingle();
      if (!existing) {
        await weeklyReview(db, userId, ws).catch((e) => (res.reviewError = String(e)));
        res.review = "gerada";
      }
    }
    out[userId.slice(0, 8)] = res;
  }
  return NextResponse.json({ ok: true, ...out });
}

export const GET = handle;
export const POST = handle;
