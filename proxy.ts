import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/entrar", "/auth", "/api/cron", "/api/mcp", "/manifest.webmanifest", "/sw.js", "/offline"];

/** Renova a sessão Supabase e redireciona para /login quem não está autenticado. */
/** Página de diagnóstico quando a configuração está incompleta (nunca mostra valores, só nomes). */
function configError(problems: string[]) {
  const items = problems.map((p) => `<li>${p}</li>`).join("");
  const html = `<!doctype html><html lang="pt-PT"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Configuração incompleta</title>
<body style="font-family:system-ui,sans-serif;max-width:560px;margin:2rem auto;padding:0 1rem;line-height:1.5">
<h1 style="font-size:1.3rem">Configuração incompleta</h1>
<p>A app está publicada, mas falta corrigir isto na Vercel (<b>Settings → Environment Variables</b>):</p><ul>${items}</ul>
<p>Depois de corrigir, faz <b>Deployments → ⋯ → Redeploy</b> (as variáveis <code>NEXT_PUBLIC_*</code> só entram num novo deploy).</p></body></html>`;
  return new NextResponse(html, { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

function configProblems(env: Record<string, string | undefined>): string[] {
  const out: string[] = [];
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!url) out.push("Falta <code>NEXT_PUBLIC_SUPABASE_URL</code>.");
  else if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url)) out.push("<code>NEXT_PUBLIC_SUPABASE_URL</code> deve ser só <code>https://xxxx.supabase.co</code> (sem /rest/v1 nem espaços).");
  if (!env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()) out.push("Falta <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> (ou <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>): a chave publishable do Supabase.");
  if (!env.ALLOWED_EMAIL?.trim()) out.push("Falta <code>ALLOWED_EMAIL</code> (o teu email de login).");
  return out;
}

export async function proxy(request: NextRequest) {
  // Descoberta OAuth dos clientes MCP (claude.ai): não usamos OAuth — o acesso é pela chave no URL do conector.
  if (request.nextUrl.pathname.startsWith("/.well-known/")) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const problems = configProblems({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
    ALLOWED_EMAIL: process.env.ALLOWED_EMAIL,
  });
  if (problems.length) return configError(problems);

  let response = NextResponse.next({ request });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!.trim().replace(/\/$/, ""), (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)!.trim(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers ?? {}).forEach(([k, v]) => response.headers.set(k, v));
      },
    },
  });

  let data: Awaited<ReturnType<typeof supabase.auth.getClaims>>["data"] = null;
  try {
    data = (await supabase.auth.getClaims()).data;
  } catch {
    // sessão inválida ou Supabase inacessível: tratar como não autenticado
  }
  const email = (data?.claims?.email as string | undefined)?.toLowerCase();
  const allowed = process.env.ALLOWED_EMAIL?.toLowerCase();
  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + "/"));

  if (!isPublic && (!email || !allowed || email !== allowed)) {
    if (path.startsWith("/api/")) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons/|.*\\.(?:png|svg|jpg|jpeg|webp|ico)$).*)"],
};
