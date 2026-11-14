/**
 * Peso automático da app Saúde do iPhone (Atalho diário).
 * POST /api/ingest/weight · Authorization: Bearer <WEIGHT_INGEST_TOKEN> · JSON { "date": "...", "weight_kg": 81.2 }
 * Faz upsert em days com weight_source = "apple_health". Um peso introduzido à mão no mesmo dia prevalece.
 * Aceita os formatos que o Atalho envia ("81,2 kg", datas ISO ou em texto); sem data → hoje.
 */
import { timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { todayInTz } from "@/lib/calc/dates";
import { parseHealthDate, parseWeight, round1, validWeight } from "@/lib/integrations/health-weight";
import { resolveUser } from "@/lib/mcp/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function tokenOk(header: string | null): boolean {
  const expected = process.env.WEIGHT_INGEST_TOKEN?.trim();
  if (!expected || expected.length < 20) return false;
  const given = Buffer.from((header ?? "").replace(/^Bearer\s+/i, "").trim());
  const want = Buffer.from(expected);
  return given.length === want.length && timingSafeEqual(given, want);
}

export async function POST(req: NextRequest) {
  if (!process.env.WEIGHT_INGEST_TOKEN?.trim()) return NextResponse.json({ ok: false, error: "WEIGHT_INGEST_TOKEN não está definido na Vercel" }, { status: 503 });
  if (!tokenOk(req.headers.get("authorization"))) return NextResponse.json({ ok: false, error: "Token inválido" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Corpo JSON inválido" }, { status: 400 });
  }
  const kg = parseWeight(body.weight_kg);
  if (!validWeight(kg)) return NextResponse.json({ ok: false, error: `weight_kg não reconhecido: ${JSON.stringify(body.weight_kg ?? null).slice(0, 60)}` }, { status: 400 });
  const tz = process.env.APP_TIMEZONE || "Europe/Lisbon";
  const today = todayInTz(tz);
  const date = body.date === undefined || body.date === "" ? today : parseHealthDate(body.date, tz);
  if (!date) return NextResponse.json({ ok: false, error: `date não reconhecida: ${JSON.stringify(body.date).slice(0, 60)}` }, { status: 400 });
  if (date > today) return NextResponse.json({ ok: false, error: "date no futuro" }, { status: 400 });

  const db = createAdminClient();
  const userId = await resolveUser(db);
  if (!userId) return NextResponse.json({ ok: false, error: "Utilizador não encontrado" }, { status: 500 });

  const { data: existing } = await db.from("days").select("weight_kg, weight_source").eq("user_id", userId).eq("date", date).maybeSingle();
  if (existing?.weight_source === "manual" && existing.weight_kg !== null) {
    return NextResponse.json({ ok: true, saved: false, date, weight_kg: Number(existing.weight_kg), message: "Já existe peso introduzido à mão neste dia: mantido." });
  }
  const w = round1(kg);
  const { error } = await db.from("days").upsert({ user_id: userId, date, weight_kg: w, weight_source: "apple_health" }, { onConflict: "user_id,date" });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  revalidatePath("/", "layout");
  return NextResponse.json({ ok: true, saved: true, date, weight_kg: w, message: `Peso ${String(w).replace(".", ",")} kg gravado em ${date.split("-").reverse().join("/")}.` });
}
