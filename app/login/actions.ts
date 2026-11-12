"use server";
import { headers } from "next/headers";
import { isAllowedEmail } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function sendMagicLink(_prev: { message: string; ok: boolean } | null, form: FormData) {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  // Resposta igual para emails não autorizados, para não revelar qual é o email permitido.
  const generic = { ok: true, message: "Se o email estiver autorizado, vais receber um link de entrada. Abre-o neste dispositivo." };
  if (!email || !email.includes("@")) return { ok: false, message: "Escreve um email válido." };
  if (!isAllowedEmail(email)) return generic;
  const h = await headers();
  const origin = h.get("origin") ?? `https://${h.get("host")}`;
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${origin}/auth/confirm`, shouldCreateUser: true } });
  if (error) return { ok: false, message: `Não foi possível enviar o link: ${error.message}` };
  return generic;
}
