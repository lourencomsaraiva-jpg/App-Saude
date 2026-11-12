import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "./supabase/server";

export function isAllowedEmail(email: string | null | undefined): boolean {
  const allowed = process.env.ALLOWED_EMAIL?.trim().toLowerCase();
  return !!allowed && !!email && email.trim().toLowerCase() === allowed;
}

/**
 * Lê a sessão com getClaims(): valida o JWT localmente (sem ida ao servidor de Auth quando o projeto
 * usa chaves de assinatura assimétricas), o que poupa uma ida e volta ao Supabase em cada pedido.
 */
async function currentUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const email = typeof claims?.email === "string" ? claims.email : null;
  if (!claims?.sub || !isAllowedEmail(email)) return { supabase, user: null };
  return { supabase, user: { id: claims.sub, email } };
}

/** Utilizador autenticado e autorizado + cliente Supabase (RLS). Redireciona para /login caso contrário. */
export const requireUser = cache(async () => {
  const { supabase, user } = await currentUser();
  if (!user) redirect("/login");
  return { supabase, user };
});

/** Versão para route handlers: devolve null em vez de redirecionar. */
export async function getApiUser() {
  const { supabase, user } = await currentUser();
  return user ? { supabase, user } : null;
}
