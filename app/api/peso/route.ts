/**
 * Recebe o peso da balança via app Saúde do iPhone (Atalho automático).
 * POST /api/peso  ·  Authorization: Bearer <ACCESS_KEY>  ·  JSON { "peso": 81.2, "data": "<data da amostra>" }
 * (também aceita kg/weight/value e date). Sem data → hoje. Grava como fonte "apple_health".
 */
import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { todayInTz } from "@/lib/calc/dates";
import { parseHealthDate, parseWeight, round1, validWeight } from "@/lib/integrations/health-weight";
import { keyOk, resolveUser } from "@/lib/mcp/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? req.nextUrl.searchParams.get("chave") ?? "";
  if (!keyOk(auth)) return NextResponse.json({ ok: false, erro: "Chave inválida" }, { status: 401 });

  let body: Record<string, unknown> = {};
  const text = await req.text();
  try {
    body = JSON.parse(text);
  } catch {
    body = { peso: text }; // corpo em texto simples
  }
  const kg = parseWeight(body.peso ?? body.kg ?? body.weight ?? body.value);
  if (!validWeight(kg)) return NextResponse.json({ ok: false, erro: `Peso não reconhecido: ${JSON.stringify(body.peso ?? body.kg ?? text).slice(0, 80)}` }, { status: 400 });
  const tz = process.env.APP_TIMEZONE || "Europe/Lisbon";
  const today = todayInTz(tz);
  const date = parseHealthDate(body.data ?? body.date, tz) ?? today;
  if (date > today) return NextResponse.json({ ok: false, erro: "Data no futuro" }, { status: 400 });

  const db = createAdminClient();
  const userId = await resolveUser(db);
  if (!userId) return NextResponse.json({ ok: false, erro: "Utilizador não encontrado" }, { status: 500 });
  const { error } = await db.from("days").upsert({ user_id: userId, date, weight_kg: round1(kg), weight_source: "apple_health" }, { onConflict: "user_id,date" });
  if (error) return NextResponse.json({ ok: false, erro: error.message }, { status: 500 });
  revalidatePath("/", "layout");
  return NextResponse.json({ ok: true, data: date, peso: round1(kg), mensagem: `Peso ${String(round1(kg)).replace(".", ",")} kg gravado em ${date.split("-").reverse().join("/")}.` });
}
