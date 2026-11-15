/**
 * (CRON_SECRET) Define o ritmo de limiar da corrida no Intervals (?limiar=4:30) e reenvia os treinos de corrida
 * dos próximos 14 dias, para o Garmin receber os alvos de ritmo de cada passo.
 */
import { NextResponse, type NextRequest } from "next/server";
import { addDays, todayInTz } from "@/lib/calc/dates";
import { intervalsConfigFromEnv, setRunThresholdPace } from "@/lib/integrations/intervals";
import { sendPlannedWorkout } from "@/lib/integrations/send-workout";
import { resolveUser } from "@/lib/mcp/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const cfg = intervalsConfigFromEnv();
  if (!cfg) return NextResponse.json({ error: "Intervals não configurado" }, { status: 500 });
  const m = (req.nextUrl.searchParams.get("limiar") ?? "").match(/^(\d):(\d{2})$/);
  const out: Record<string, unknown> = {};
  if (m) out.limiar = await setRunThresholdPace(cfg, Number(m[1]) * 60 + Number(m[2]));

  const db = createAdminClient();
  const userId = await resolveUser(db);
  if (!userId) return NextResponse.json({ error: "Utilizador não encontrado" }, { status: 500 });
  const today = todayInTz();
  const { data } = await db.from("planned_workouts").select("id, date, type").eq("user_id", userId).gte("date", today).lte("date", addDays(today, 14)).in("type", ["fácil", "qualidade", "longo", "prova", "recuperação"]).order("date");
  const sent: string[] = [];
  for (const w of data ?? []) {
    try {
      const r = await sendPlannedWorkout(db, userId, w.id);
      sent.push(`${r.date} ${r.name}`);
    } catch (e) {
      sent.push(`${w.date} ERRO ${(e as Error).message}`);
    }
  }
  out.reenviados = sent;
  return NextResponse.json(out);
}
