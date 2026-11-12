"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isAllowedEmail } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { step: "email" | "code"; email: string; ok: boolean; message: string } | null;

/** Passo 1: envia o email com o código (e o link). */
export async function sendCode(_prev: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) return { step: "email", email, ok: false, message: "Escreve um email válido." };
  // Para emails não autorizados mostra-se o mesmo ecrã, para não revelar qual é o email permitido.
  if (!isAllowedEmail(email)) return { step: "code", email, ok: true, message: "Se o email estiver autorizado, recebes um código de entrada." };
  const h = await headers();
  const origin = h.get("origin") ?? `https://${h.get("host")}`;
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${origin}/auth/confirm`, shouldCreateUser: true } });
  if (error) return { step: "email", email, ok: false, message: `Não foi possível enviar o email: ${error.message}` };
  return { step: "code", email, ok: true, message: "Enviámos um código para o teu email. Escreve-o aqui (não precisas de abrir o link)." };
}

/** Passo 2: valida o código dentro da própria app (funciona na app instalada no ecrã principal). */
export async function verifyCode(_prev: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const token = String(form.get("code") ?? "").replace(/\D/g, "");
  if (token.length < 6) return { step: "code", email, ok: false, message: "O código tem pelo menos 6 algarismos." };
  if (!isAllowedEmail(email)) return { step: "code", email, ok: false, message: "Código inválido ou expirado." };
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error) return { step: "code", email, ok: false, message: "Código inválido ou expirado. Pede outro." };
  redirect("/");
}

/** Entrada com email + password (sem emails; funciona na app instalada no ecrã principal). */
export async function signInPassword(_prev: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const fail = { step: "email" as const, email, ok: false, message: "Email ou password errados. Se ainda não definiste password, entra por email e define-a em Definições." };
  if (!isAllowedEmail(email) || !password) return fail;
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return fail;
  redirect("/");
}
