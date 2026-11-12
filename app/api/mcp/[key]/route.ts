/**
 * Conector MCP para o Claude (claude.ai → Settings → Connectors → Add custom connector).
 * URL: https://<app>/api/mcp/<ACCESS_KEY>   — a chave no caminho protege o acesso.
 * Modo sem sessão (stateless): cada pedido cria o servidor e responde em JSON.
 */
import { timingSafeEqual } from "node:crypto";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { COACH_SYSTEM } from "@/lib/ai/coach";
import { todayInTz } from "@/lib/calc/dates";
import { callTool, listTools } from "@/lib/mcp/tools";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DB } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function keyOk(given: string) {
  const expected = process.env.ACCESS_KEY?.trim();
  if (!expected || expected.length < 20) return false;
  const a = Buffer.from(decodeURIComponent(given));
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

let cachedUserId: string | null = null;
async function resolveUser(db: DB): Promise<string | null> {
  if (cachedUserId) return cachedUserId;
  const email = process.env.ALLOWED_EMAIL?.trim().toLowerCase();
  if (!email) return null;
  const { data: profiles } = await db.from("profile").select("user_id");
  for (const p of profiles ?? []) {
    const { data } = await db.auth.admin.getUserById(p.user_id);
    if (data.user?.email?.toLowerCase() === email) return (cachedUserId = p.user_id);
  }
  return null;
}

const INSTRUCTIONS = `${COACH_SYSTEM}

Estas ferramentas ligam-te à app "Treino & Nutrição" do atleta (dados reais: dias, refeições, treinos do Garmin via Intervals.icu, sono, peso, plano).
- Antes de responder sobre um dia, chama get_days. Para registar comida: search_foods (usa os valores da tabela pessoal quando existirem) → add_food → responde com a tabela pedida usando os números "day" devolvidos.
- Só alteras o plano (update_planned_workout) depois de o atleta concordar.`;

function buildServer(db: DB) {
  const server = new Server({ name: "treino-nutricao", version: "1.0.0" }, { capabilities: { tools: {} }, instructions: INSTRUCTIONS });
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: listTools() }));
  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    try {
      const userId = await resolveUser(db);
      if (!userId) return { content: [{ type: "text", text: "Utilizador não encontrado: entra na app uma vez com o email autorizado." }], isError: true };
      const out = await callTool(db, userId, req.params.name, (req.params.arguments ?? {}) as Record<string, unknown>);
      const isError = !!out && typeof out === "object" && "error" in (out as object);
      if (!isError && !req.params.name.startsWith("get_") && req.params.name !== "search_foods") revalidatePath("/", "layout");
      return { content: [{ type: "text", text: JSON.stringify({ today: todayInTz(), result: out }) }], isError };
    } catch (e) {
      return { content: [{ type: "text", text: `Erro: ${(e as Error).message}` }], isError: true };
    }
  });
  return server;
}

async function handle(req: Request, ctx: { params: Promise<{ key: string }> }) {
  const { key } = await ctx.params;
  if (!keyOk(key)) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (req.method !== "POST") return new Response(null, { status: 405, headers: { Allow: "POST" } });
  const server = buildServer(createAdminClient());
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  return transport.handleRequest(req);
}

export const POST = handle;
export const GET = handle;
export const DELETE = handle;
