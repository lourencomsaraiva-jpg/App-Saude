/** Diagnóstico (CRON_SECRET): treinos no calendário do Intervals e como foram convertidos em passos. */
import { NextResponse, type NextRequest } from "next/server";
import { fetchEvents, fetchRunSettings, intervalsConfigFromEnv } from "@/lib/integrations/intervals";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const cfg = intervalsConfigFromEnv();
  if (!cfg) return NextResponse.json({ error: "Intervals não configurado" }, { status: 500 });
  const de = req.nextUrl.searchParams.get("de") ?? "";
  const ate = req.nextUrl.searchParams.get("ate") ?? de;
  const [events, run] = await Promise.all([fetchEvents(cfg, de, ate), fetchRunSettings(cfg).catch((e) => String(e))]);
  return NextResponse.json({
    run,
    events: events
      .filter((e) => e.category === "WORKOUT")
      .map((e) => ({ date: e.start_date_local, name: e.name, external_id: e.external_id, description: e.description, workout_doc: e.workout_doc })),
  });
}
