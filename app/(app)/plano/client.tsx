"use client";
import { useState, useTransition } from "react";
import { addWorkout, deleteWorkout, saveStrengthExercise, updateWorkout } from "../actions";
import { formatPace, parseDurationHms } from "@/lib/calc/running";
import { parseDecimal } from "@/lib/calc/numbers";
import type { PlannedWorkoutRow, StrengthSessionRow } from "@/lib/types";

const TYPES = ["descanso", "fácil", "qualidade", "longo", "força", "prova", "recuperação"];
const STATUS = ["planeado", "feito", "falhado", "alterado"];

function fields(f: FormData) {
  const pace = (k: string) => {
    const v = String(f.get(k) ?? "").trim();
    return v ? parseDurationHms(v) : null;
  };
  return {
    date: String(f.get("date")),
    type: String(f.get("type")),
    title: String(f.get("title")),
    distance_km: parseDecimal(String(f.get("distance_km") ?? "")),
    target_pace_min_s: pace("pmin"),
    target_pace_max_s: pace("pmax"),
    target_hr_max: parseDecimal(String(f.get("hrmax") ?? "")),
    structure: String(f.get("structure") ?? "")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((description) => ({ kind: "nota", description })),
  };
}

function WorkoutForm({ w, onSubmit, pending, submitLabel }: { w?: Partial<PlannedWorkoutRow>; onSubmit: (f: FormData) => void; pending: boolean; submitLabel: string }) {
  return (
    <form className="mt-2 grid grid-cols-2 gap-2 rounded-lg bg-soft p-2" onSubmit={(e) => { e.preventDefault(); onSubmit(new FormData(e.currentTarget)); }}>
      <label><span className="label">Data</span><input type="date" name="date" defaultValue={w?.date} required /></label>
      <label><span className="label">Tipo</span><select name="type" defaultValue={w?.type ?? "fácil"}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
      <label className="col-span-2"><span className="label">Título</span><input name="title" defaultValue={w?.title} required /></label>
      <label><span className="label">Distância (km)</span><input name="distance_km" inputMode="decimal" defaultValue={w?.distance_km ?? ""} /></label>
      <label><span className="label">FC máx.</span><input name="hrmax" inputMode="numeric" defaultValue={w?.target_hr_max ?? ""} /></label>
      <label><span className="label">Ritmo de (m:ss)</span><input name="pmin" defaultValue={w?.target_pace_min_s ? formatPace(w.target_pace_min_s / 60) : ""} /></label>
      <label><span className="label">Ritmo até (m:ss)</span><input name="pmax" defaultValue={w?.target_pace_max_s ? formatPace(w.target_pace_max_s / 60) : ""} /></label>
      <label className="col-span-2"><span className="label">Estrutura (uma linha por passo)</span><textarea name="structure" rows={3} defaultValue={(w?.structure ?? []).map((s) => `${s.repeat ? `${s.repeat} × ` : ""}${s.description}`).join("\n")} /></label>
      <label className="col-span-2"><span className="label">Motivo da alteração (obrigatório)</span><input name="reason" required /></label>
      <button className="btn btn-sm col-span-2" disabled={pending}>{submitLabel}</button>
    </form>
  );
}

export function WorkoutEditor({ workout }: { workout: PlannedWorkoutRow }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="mt-1">
      <div className="flex flex-wrap items-center gap-2">
        <button className="text-xs text-accent" onClick={() => setOpen((v) => !v)}>{open ? "Fechar" : "Editar / mover"}</button>
        <select className="!w-auto !py-0.5 text-xs" value={workout.status} onChange={(e) => { const s = e.target.value; start(async () => { const r = await updateWorkout(workout.id, { status: s }, `Estado → ${s}`); setErr(r.ok ? null : r.message); }); }} aria-label="Estado">
          {STATUS.map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>
      {open && (
        <>
          <WorkoutForm
            w={workout}
            pending={pending}
            submitLabel="Guardar alteração"
            onSubmit={(f) => start(async () => { const r = await updateWorkout(workout.id, fields(f), String(f.get("reason"))); if (r.ok) setOpen(false); else setErr(r.message); })}
          />
          <button className="btn btn-danger btn-sm mt-2" disabled={pending} onClick={() => { const reason = prompt("Motivo para remover?"); if (reason) start(async () => { const r = await deleteWorkout(workout.id, reason); setErr(r.ok ? null : r.message); }); }}>Remover treino</button>
        </>
      )}
      {err && <p className="text-xs text-bad">{err}</p>}
    </div>
  );
}

export function AddWorkout({ defaultDate }: { defaultDate: string }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="mt-3">
      <button className="btn btn-ghost btn-sm" onClick={() => setOpen((v) => !v)}>{open ? "Cancelar" : "+ Adicionar treino"}</button>
      {open && <WorkoutForm w={{ date: defaultDate }} pending={pending} submitLabel="Adicionar" onSubmit={(f) => start(async () => { const r = await addWorkout(fields(f), String(f.get("reason"))); if (r.ok) setOpen(false); else setErr(r.message); })} />}
      {err && <p className="text-xs text-bad">{err}</p>}
    </div>
  );
}

const DOW = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

export function StrengthEditor({ sessions }: { sessions: StrengthSessionRow[] }) {
  const [pending, start] = useTransition();
  return (
    <div className="space-y-4">
      {sessions.map((s) => (
        <div key={s.id}>
          <h3 className="text-sm font-semibold">{s.day_of_week !== null ? `${DOW[s.day_of_week]} · ` : ""}{s.name}</h3>
          {s.notes && <p className="text-xs text-muted">{s.notes}</p>}
          <table className="num mt-2 w-full text-xs">
            <thead className="text-muted"><tr className="text-left"><th className="py-1">Exercício</th><th>Séries</th><th>Reps</th><th>Carga kg</th></tr></thead>
            <tbody>
              {[...(s.strength_exercises ?? [])].sort((a, b) => a.position - b.position).map((e) => (
                <tr key={e.id} className={`border-t border-line align-top ${pending ? "opacity-60" : ""}`}>
                  <td className="py-1.5 pr-2">
                    <span className="chip mr-1">{e.superset}</span>{e.name}
                    {e.notes && <div className="text-muted">{e.notes}</div>}
                  </td>
                  <td><input className="!w-12 !px-1 !py-0.5 text-xs" defaultValue={e.sets ?? ""} onBlur={(ev) => ev.target.value !== String(e.sets ?? "") && start(async () => { await saveStrengthExercise(e.id, { sets: ev.target.value }); })} /></td>
                  <td><input className="!w-20 !px-1 !py-0.5 text-xs" defaultValue={e.reps ?? ""} onBlur={(ev) => ev.target.value !== (e.reps ?? "") && start(async () => { await saveStrengthExercise(e.id, { reps: ev.target.value }); })} /></td>
                  <td><input className="!w-14 !px-1 !py-0.5 text-xs" inputMode="decimal" defaultValue={e.load_kg ?? ""} onBlur={(ev) => ev.target.value !== String(e.load_kg ?? "") && start(async () => { await saveStrengthExercise(e.id, { load_kg: ev.target.value }); })} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
      <p className="text-xs text-muted">Halteres ajustáveis 2–24 kg; carga total quando são dois halteres. As letras agrupam os supersets.</p>
    </div>
  );
}
