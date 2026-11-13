/** Conector MCP com a chave no caminho: /api/mcp/<ACCESS_KEY> (alternativa ao cabeçalho). */
import { serveMcp } from "@/lib/mcp/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function handle(req: Request, ctx: { params: Promise<{ key: string }> }) {
  const { key } = await ctx.params;
  return serveMcp(req, key);
}

export const POST = handle;
export const GET = handle;
export const DELETE = handle;
