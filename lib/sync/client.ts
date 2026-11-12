/** Chamada do browser à rota /api/sync. */
export interface SyncResponse {
  ok: boolean;
  imported: number;
  errors: string[];
  skipped?: boolean;
}

export async function requestSync(trigger: "manual" | "open", backfillDays?: number): Promise<SyncResponse> {
  try {
    const res = await fetch("/api/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ trigger, backfillDays }) });
    return (await res.json()) as SyncResponse;
  } catch (e) {
    return { ok: false, imported: 0, errors: [(e as Error).message] };
  }
}
