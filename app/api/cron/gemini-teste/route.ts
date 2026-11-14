/**
 * Diagnóstico do Gemini (protegido por CRON_SECRET; corre a partir do Supabase pg_net): lista os modelos "flash" que a chave pode usar
 * e testa cada um com um pedido mínimo. Abre /api/gemini-teste no telemóvel.
 */
import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BASE = "https://generativelanguage.googleapis.com/v1beta";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) return new NextResponse("Falta GEMINI_API_KEY na Vercel.", { status: 500 });
  const h = { "x-goog-api-key": key, "Content-Type": "application/json" };
  const lines: string[] = [`Configurado: GEMINI_MODEL=${process.env.GEMINI_MODEL ?? "(vazio)"} · GEMINI_FALLBACK_MODELS=${process.env.GEMINI_FALLBACK_MODELS ?? "(vazio)"}`, ""];

  const list = await fetch(`${BASE}/models?pageSize=200`, { headers: h, cache: "no-store" });
  if (!list.ok) return new NextResponse(`Listar modelos falhou: ${list.status} ${(await list.text()).slice(0, 300)}`, { status: 200 });
  const { models = [] } = (await list.json()) as { models?: Array<{ name: string; supportedGenerationMethods?: string[] }> };
  const flash = models
    .map((m) => ({ id: m.name.replace(/^models\//, ""), ok: m.supportedGenerationMethods?.includes("generateContent") }))
    .filter((m) => m.ok && /flash/.test(m.id) && !/image|tts|audio|live|embed/.test(m.id))
    .map((m) => m.id);
  lines.push(`Modelos flash disponíveis (${flash.length}): ${flash.join(", ")}`, "");

  const test = async (id: string) => {
    const t0 = Date.now();
    try {
      const r = await fetch(`${BASE}/models/${id}:generateContent`, {
        method: "POST",
        headers: h,
        body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: "Responde só: ok" }] }] }),
        signal: AbortSignal.timeout(12_000),
        cache: "no-store",
      });
      const body = await r.text();
      const msg = r.ok ? "OK" : `${r.status} ${body.match(/"message":\s*"([^"]{0,120})/)?.[1] ?? ""}`;
      return `${r.ok ? "✅" : "❌"} ${id} — ${msg} (${((Date.now() - t0) / 1000).toFixed(1)} s)`;
    } catch (e) {
      return `❌ ${id} — ${(e as Error).name === "TimeoutError" ? "demorou mais de 12 s" : (e as Error).message}`;
    }
  };
  lines.push(...(await Promise.all(flash.slice(0, 12).map(test))));
  return new NextResponse(lines.join("\n"), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
