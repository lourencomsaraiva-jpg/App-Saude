"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { requestSync } from "@/lib/sync/client";

export function SyncButton({ compact = false }: { compact?: boolean }) {
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();
  return (
    <span className="inline-flex items-center gap-2">
      <button
        className={`btn btn-ghost ${compact ? "btn-sm" : ""}`}
        disabled={pending}
        onClick={async () => {
          setPending(true);
          const r = await requestSync("manual");
          setPending(false);
          setMsg(r.ok ? `${r.imported} registos${r.errors.length ? ` · ${r.errors.length} avisos` : ""}` : r.errors[0] ?? "Erro");
          router.refresh();
          setTimeout(() => setMsg(null), 6000);
        }}
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
