"use client";
import { useState, useTransition } from "react";
import { syncNow } from "@/app/(app)/actions";

export function SyncButton({ compact = false }: { compact?: boolean }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <span className="inline-flex items-center gap-2">
      <button
        className={`btn btn-ghost ${compact ? "btn-sm" : ""}`}
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await syncNow("manual");
            setMsg(r.ok ? `${r.data?.imported ?? 0} registos${r.data?.errors.length ? ` · ${r.data.errors.length} avisos` : ""}` : r.message);
            setTimeout(() => setMsg(null), 6000);
          })
        }
        aria-label="Sincronizar agora"
      >
        <svg viewBox="0 0 24 24" className={`h-4 w-4 ${pending ? "animate-spin" : ""}`} fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
          <path d="M20 11a8 8 0 10-2.3 5.7M20 4v7h-7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {!compact && (pending ? "A sincronizar…" : "Sincronizar agora")}
      </button>
      {msg && <span className="text-xs text-muted">{msg}</span>}
    </span>
  );
}
