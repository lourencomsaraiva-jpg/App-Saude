"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { analyzeActivityNow, deleteActivity, saveActivityNotes } from "../../actions";

export function ActivityNotes({ id, conditions, feel }: { id: string; conditions: string | null; feel: string | null }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        start(async () => {
          const r = await saveActivityNotes(id, String(f.get("conditions") ?? ""), String(f.get("feel") ?? ""));
          setMsg(r.ok ? "Guardado." : r.message);
        });
      }}
    >
      <label className="block"><span className="label">Condições (vento, chuva, calor, percurso)</span><textarea name="conditions" rows={2} defaultValue={conditions ?? ""} /></label>
      <label className="block"><span className="label">Sensação (RPE, dores, energia)</span><textarea name="feel" rows={2} defaultValue={feel ?? ""} /></label>
      <button className="btn btn-sm" disabled={pending}>Guardar</button>
      {msg && <span className="ml-2 text-xs text-muted">{msg}</span>}
    </form>
  );
}

export function AnalyzeButton({ id, hasAnalysis }: { id: string; hasAnalysis: boolean }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <span className="flex items-center gap-2">
      {err && <span className="text-xs text-bad">{err}</span>}
      <button className="btn btn-ghost btn-sm" disabled={pending} onClick={() => start(async () => { const r = await analyzeActivityNow(id); setErr(r.ok ? null : r.message); })}>
        {pending ? "A analisar…" : hasAnalysis ? "Refazer" : "Analisar"}
      </button>
    </span>
  );
}

export function DeleteActivity({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button className="btn btn-danger w-full" disabled={pending} onClick={() => confirm("Apagar este treino?") && start(async () => { const r = await deleteActivity(id); if (r.ok) router.push("/treinos"); else alert(r.message); })}>
      Apagar treino
    </button>
  );
}
