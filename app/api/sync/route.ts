import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { getApiUser } from "@/lib/auth";
import { runUserSync } from "@/lib/sync/run";

export const maxDuration = 300;

/**
 * POST /api/sync { trigger: "manual" | "open", backfillDays? }
 * Rota normal (não server action) para não bloquear os outros botões enquanto sincroniza.
 */
export async function POST(req: NextRequest) {
  const auth = await getApiUser();
  if (!auth) return NextResponse.json({ ok: false, errors: ["Não autenticado"] }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { trigger?: string; backfillDays?: number };
  const trigger = body.trigger === "open" ? "open" : "manual";
  const res = await runUserSync(auth.supabase, auth.user.id, trigger, typeof body.backfillDays === "number" ? body.backfillDays : undefined);
  if (res.imported > 0) revalidatePath("/", "layout");
  return NextResponse.json(res);
}
