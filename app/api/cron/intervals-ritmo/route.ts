/**
 * (CRON_SECRET) Define o ritmo de limiar da corrida no Intervals (?limiar=4:30) e reenvia os treinos de corrida
 * dos próximos 14 dias, para o Garmin receber os alvos de ritmo de cada passo. Apaga os que já não estão no plano.
 */
import { NextResponse, type NextRequest } from "next/server";
import { addDays, todayInTz } from "@/lib/calc/dates";
import { deleteEvent, fetchEvents, intervalsConfigFromEnv, setRunThresholdPace } from "@/lib/integrations/intervals";
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
  // apaga do calendário os treinos da app que já não correspondem ao plano (dia mudado ou removido)
  const valid = new Set((data ?? []).map((w) => `app-${w.id}-${w.date}`));
  const removed: string[] = [];
  for (const e of await fetchEvents(cfg, today, addDays(today, 14))) {
    const ext = String(e.external_id ?? "");
    if (e.category === "WORKOUT" && ext.startsWith("app-") && !valid.has(ext)) {
      await deleteEvent(cfg, e.id as string);
      removed.push(`${String(e.start_date_local).slice(0, 10)} ${e.name}`);
    }
  }
  out.removidos = removed;
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
