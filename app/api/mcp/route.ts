/**
 * Conector MCP para o Claude: https://<app>/api/mcp
 * Chave no cabeçalho "Authorization: Bearer <ACCESS_KEY>" (ou "X-Api-Key: <ACCESS_KEY>").
 */
import { serveMcp } from "@/lib/mcp/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function keyFrom(req: Request): string {
  const auth = req.headers.get("authorization") ?? "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return (m ? m[1] : req.headers.get("x-api-key") ?? "").trim();
}

async function handle(req: Request) {
  return serveMcp(req, keyFrom(req));
}

export const POST = handle;
export const GET = handle;
export const DELETE = handle;
