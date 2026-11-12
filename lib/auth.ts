import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "./supabase/server";

export function isAllowedEmail(email: string | null | undefined): boolean {
  const allowed = process.env.ALLOWED_EMAIL?.trim().toLowerCase();
  return !!allowed && !!email && email.trim().toLowerCase() === allowed;
}

/** Utilizador autenticado e autorizado + cliente Supabase (RLS). Redireciona para /login caso contrário. */
export const requireUser = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user || !isAllowedEmail(user.email)) redirect("/login");
  return { supabase, user };
});

/** Versão para route handlers: devolve null em vez de redirecionar. */
export async function getApiUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user || !isAllowedEmail(user.email)) return null;
  return { supabase, user };
}
