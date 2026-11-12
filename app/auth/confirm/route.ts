import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { isAllowedEmail } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/** Destino do link mágico (suporta ?code= (PKCE) e ?token_hash=&type=). */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const supabase = await createClient();
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;

  let error: string | null = null;
  if (code) error = (await supabase.auth.exchangeCodeForSession(code)).error?.message ?? null;
  else if (tokenHash && type) error = (await supabase.auth.verifyOtp({ token_hash: tokenHash, type })).error?.message ?? null;
  else error = "Link inválido.";

  const { data } = await supabase.auth.getUser();
  if (error || !data.user || !isAllowedEmail(data.user.email)) {
    await supabase.auth.signOut();
    const to = new URL("/login", url.origin);
    to.searchParams.set("erro", error ? "O link expirou ou já foi usado. Pede outro." : "Email não autorizado.");
    return NextResponse.redirect(to);
  }
  return NextResponse.redirect(new URL("/", url.origin));
}
