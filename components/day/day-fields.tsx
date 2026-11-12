"use client";
import { useState, useTransition } from "react";
import { saveDayFields, saveSleep, saveWeight } from "@/app/(app)/actions";
import { formatDatePt } from "@/lib/calc/dates";
import { fmt } from "@/lib/calc/numbers";

const SRC: Record<string, string> = { intervals: "Garmin", manual: "manual", seed: "histórico", fit: "FIT" };

export function DayFields(p: {
  date: string;
  weight: number | null;
  weightSource: string | null;
  steps: number | null;
  notes: string | null;
  sleepText: string;
  sleepSource: string | null;
  sleepScore: number | null;
  sleepDayDate: string;
  sleepSummary: string | null;
  restingHr: number | null;
  hrv: number | null;
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const done = (r: { ok: boolean; message?: string }, okText = "Guardado.") => {
    setMsg(r.ok ? { ok: true, text: okText } : { ok: false, text: r.message ?? "Erro." });
    if (r.ok) setTimeout(() => setMsg(null), 2500);
  };

  return (
    <section className="card space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <form key={`w-${p.date}-${p.weight}`} onSubmit={(e) => { e.preventDefault(); const v = String(new FormData(e.currentTarget).get("w") ?? ""); start(async () => done(await saveWeight(p.date, v))); }}>
          <label className="label" htmlFor="w">Peso (kg){p.weightSource ? ` · ${SRC[p.weightSource] ?? p.weightSource}` : ""}</label>
          <div className="flex gap-1">
            <input id="w" name="w" inputMode="decimal" defaultValue={p.weight ?? ""} placeholder="78,0" className="num" />
            <button className="btn btn-sm" disabled={pending}>OK</button>
          </div>
        </form>
        <form key={`s-${p.date}-${p.steps}`} onSubmit={(e) => { e.preventDefault(); const v = String(new FormData(e.currentTarget).get("s") ?? ""); start(async () => done(await saveDayFields(p.date, { steps: v }))); }}>
          <label className="label" htmlFor="s">Passos</label>
          <div className="flex gap-1">
            <input id="s" name="s" inputMode="numeric" defaultValue={p.steps ?? ""} className="num" />
            <button className="btn btn-sm" disabled={pending}>OK</button>
          </div>
        </form>
      </div>

      <form key={`sl-${p.sleepDayDate}-${p.sleepText}-${p.sleepScore}`} onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); start(async () => done(await saveSleep(p.sleepDayDate, String(f.get("sleep") ?? ""), String(f.get("score") ?? "")))); }}>
        <label className="label" htmlFor="sleep">
          Sono da noite de {formatDatePt(p.sleepDayDate)}{p.sleepSource ? ` · ${SRC[p.sleepSource] ?? p.sleepSource}` : ""}{p.sleepSummary ? ` · ${p.sleepSummary}` : ""}
        </label>
        <div className="flex gap-1">
          <input id="sleep" name="sleep" defaultValue={p.sleepText} placeholder="7:35 (profundo 1:37, leve 4:49, REM 1:09, acordado 27min)" />
          <input name="score" inputMode="numeric" defaultValue={p.sleepScore ?? ""} placeholder="pont." className="num !w-16" aria-label="Pontuação do sono" />
          <button className="btn btn-sm" disabled={pending}>OK</button>
        </div>
        <p className="mt-1 text-xs text-muted">Formato: total e, se tiveres, fases. Profundo + leve + REM tem de dar o total.</p>
      </form>

      {(p.restingHr || p.hrv) && (
        <p className="num text-xs text-muted">
          {p.restingHr ? `FC repouso ${p.restingHr}` : ""}
          {p.restingHr && p.hrv ? " · " : ""}
          {p.hrv ? `VFC ${fmt(p.hrv)}` : ""}
        </p>
      )}

      <div>
        <label className="label" htmlFor="notes">Notas do dia</label>
        <textarea key={`n-${p.date}-${p.notes ?? ""}`} id="notes" rows={3} defaultValue={p.notes ?? ""} onBlur={(e) => { if (e.target.value !== (p.notes ?? "")) { const v = e.target.value; start(async () => done(await saveDayFields(p.date, { notes: v }), "Notas guardadas.")); } }} />
      </div>
      {msg && <p className={`text-sm ${msg.ok ? "text-good" : "text-bad"}`}>{msg.text}</p>}
    </section>
  );
}
