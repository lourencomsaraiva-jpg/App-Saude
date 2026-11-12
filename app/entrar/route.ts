import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Link pessoal de acesso: /entrar?chave=<ACCESS_KEY>
 * Abre uma sessão para ALLOWED_EMAIL sem enviar emails (a sessão dura ~400 dias e renova-se sozinha).
 * Sem ACCESS_KEY definido na Vercel, esta rota está desligada.
 */
function keyMatches(given: string): boolean {
  const expected = process.env.ACCESS_KEY?.trim();
  if (!expected || expected.length < 20 || !given) return false;
  const a = Buffer.from(given.trim());
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function enter(req: NextRequest, key: string) {
  const origin = req.nextUrl.origin;
  const fail = (msg: string) => NextResponse.redirect(new URL(`/login?erro=${encodeURIComponent(msg)}`, origin), { status: 303 });
  if (!keyMatches(key)) {
    await new Promise((r) => setTimeout(r, 800)); // trava tentativas repetidas
    return fail("Chave de acesso inválida.");
  }
  const email = process.env.ALLOWED_EMAIL?.trim().toLowerCase();
  if (!email) return fail("Falta ALLOWED_EMAIL na Vercel.");
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
    if (error || !data.properties?.hashed_token) return fail(`Não foi possível entrar: ${error?.message ?? "sem token"}`);
    const supabase = await createClient();
    const { error: vErr } = await supabase.auth.verifyOtp({ token_hash: data.properties.hashed_token, type: "magiclink" });
    if (vErr) return fail(`Não foi possível entrar: ${vErr.message}`);
  } catch (e) {
    return fail(`Não foi possível entrar: ${(e as Error).message}`);
  }
  return NextResponse.redirect(new URL("/", origin), { status: 303 });
}

export async function GET(req: NextRequest) {
  return enter(req, req.nextUrl.searchParams.get("chave") ?? "");
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  return enter(req, String(form.get("chave") ?? ""));
}
