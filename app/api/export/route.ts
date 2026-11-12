import { NextResponse, type NextRequest } from "next/server";
import { getApiUser } from "@/lib/auth";
import { addDays, isISODate, todayInTz } from "@/lib/calc/dates";
import { loadDays } from "@/lib/data/days";
import { loadSettings } from "@/lib/data/settings";
import { daysToRows, toCsv } from "@/lib/export";

const TABLES = ["profile", "calorie_phases", "days", "sleep", "foods", "recipes", "recipe_items", "meals", "meal_items", "activities", "activity_laps", "races", "plans", "planned_workouts", "planned_workout_changes", "strength_sessions", "strength_exercises", "weekly_reviews", "coach_messages", "sync_log"];

/** /api/export?formato=csv|excel|json&dias=30 | &de=&ate=  — json exporta tudo (todas as tabelas). */
export async function GET(req: NextRequest) {
  const auth = await getApiUser();
  if (!auth) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const { supabase } = auth;
  const p = req.nextUrl.searchParams;
  const format = p.get("formato") ?? "csv";
  const stamp = todayInTz();

  if (format === "json") {
    const out: Record<string, unknown> = { exported_at: new Date().toISOString() };
    for (const t of TABLES) {
      const rows: unknown[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase.from(t).select("*").range(from, from + 999);
        if (error) return NextResponse.json({ error: `${t}: ${error.message}` }, { status: 500 });
        rows.push(...(data ?? []));
        if (!data || data.length < 1000) break;
      }
      out[t] = rows;
    }
    return new NextResponse(JSON.stringify(out, null, 2), { headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="treino-nutricao-${stamp}.json"` } });
  }

  const settings = await loadSettings(supabase);
  const end = isISODate(p.get("ate")) ? p.get("ate")! : todayInTz();
  const start = isISODate(p.get("de")) ? p.get("de")! : p.get("dias") === "tudo" ? settings.profile?.start_date ?? addDays(end, -365) : addDays(end, -(Math.min(Number(p.get("dias")) || 30, 2000) - 1));
  const days = await loadDays(supabase, start, end, settings);
  const excel = format === "excel";
  return new NextResponse(toCsv(daysToRows(days), excel), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="diario-${start}-a-${end}${excel ? "-excel" : ""}.csv"` },
  });
}
