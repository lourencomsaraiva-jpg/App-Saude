import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** Cliente Supabase do utilizador autenticado (respeita RLS). */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!.trim().replace(/\/$/, ""), process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Chamado a partir de um Server Component: o proxy trata da renovação da sessão.
        }
      },
    },
  });
}
