"use client";
import { useState, useTransition } from "react";
import { deletePhase, deleteRace, importSeedFile, probeWellness, savePhase, saveProfile, saveRace, setPassword, syncNow } from "../actions";

type V = Record<string, string | number | null>;
const F = ({ name, label, v, type = "text", hint }: { name: string; label: string; v: V; type?: string; hint?: string }) => (
  <label>
    <span className="label">{label}</span>
    <input name={name} type={type} inputMode={type === "text" ? undefined : undefined} defaultValue={v[name] ?? ""} placeholder={hint} />
  </label>
);

export function ProfileForm({ v }: { v: V }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); start(async () => { const r = await saveProfile(fd); setMsg(r.ok ? { ok: true, text: r.message ?? "Guardado." } : { ok: false, text: r.message }); }); }}>
      <fieldset className="grid grid-cols-2 gap-2">
        <legend className="mb-1 text-xs font-semibold">Pessoal</legend>
        <F name="name" label="Nome" v={v} />
        <F name="age" label="Idade" v={v} />
        <F name="height_cm" label="Altura (cm)" v={v} />
        <F name="start_weight_kg" label="Peso inicial (kg)" v={v} />
        <F name="start_date" label="Data de início" v={v} type="date" />
        <F name="goal_weight_kg" label="Peso objetivo (kg)" v={v} />
      </fieldset>
      <fieldset className="grid grid-cols-2 gap-2">
        <legend className="mb-1 text-xs font-semibold">Objetivos e marcas</legend>
        <F name="goal_10k_s" label="Objetivo 10 km" v={v} hint="39:59" />
        <F name="goal_hm_s" label="Objetivo meia" v={v} hint="1:29:59" />
        <F name="pb_10k_pace_s" label="Ritmo atual 10 km (/km)" v={v} hint="4:14" />
        <F name="pb_hm_s" label="Marca meia" v={v} hint="1:36:24" />
      </fieldset>
      <fieldset className="grid grid-cols-2 gap-2">
        <legend className="mb-1 text-xs font-semibold">Zonas</legend>
        <F name="easy_pace_min_s" label="Fácil de (/km)" v={v} />
        <F name="easy_pace_max_s" label="Fácil até (/km)" v={v} />
        <F name="easy_hr_max" label="FC fácil máx." v={v} />
        <F name="max_hr" label="FC máx." v={v} />
        <F name="threshold_hr_min" label="FC limiar de" v={v} />
        <F name="threshold_hr_max" label="FC limiar até" v={v} />
      </fieldset>
      <fieldset className="grid grid-cols-2 gap-2">
        <legend className="mb-1 text-xs font-semibold">Nutrição e energia</legend>
        <F name="base_burn_kcal" label="Gasto base (kcal/dia)" v={v} />
        <F name="protein_target_g" label="Proteína (g/dia)" v={v} />
        <F name="fiber_target_g" label="Fibra (g/dia)" v={v} />
        <F name="exercise_factor" label="Fator de exercício" v={v} />
        <F name="exercise_factor_start" label="Fator aplica-se desde" v={v} type="date" />
        <F name="rest_base_kcal" label="Base de dia sem exercício" v={v} />
        <F name="rest_carbs_g" label="Hidratos dia sem exercício" v={v} />
        <F name="rest_fat_g" label="Gordura dia sem exercício" v={v} />
        <F name="ratio_ref_kcal" label="Referência proporção (kcal)" v={v} />
        <F name="ratio_carbs_g" label="Hidratos na referência" v={v} />
        <F name="ratio_fat_g" label="Gordura na referência" v={v} />
      </fieldset>
      <p className="text-xs text-muted">Dia com exercício: hidratos = alvo × {String(v.ratio_carbs_g)}/{String(v.ratio_ref_kcal)}; gordura = alvo × {String(v.ratio_fat_g)}/{String(v.ratio_ref_kcal)}.</p>
      <button className="btn w-full" disabled={pending}>Guardar</button>
      {msg && <p className={`text-sm ${msg.ok ? "text-good" : "text-bad"}`}>{msg.text}</p>}
    </form>
  );
}

export function PhaseRowEditor({ phase }: { phase?: { id: string; start_date: string | null; end_date: string | null; base_kcal: number; note: string | null } }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <form className={`grid grid-cols-6 items-end gap-1 ${pending ? "opacity-60" : ""}`} onSubmit={(e) => { e.preventDefault(); const form = e.currentTarget; const fd = new FormData(form); start(async () => { const r = await savePhase(fd); if (!r.ok) setErr(r.message); else if (!phase) form.reset(); }); }}>
      {phase && <input type="hidden" name="id" value={phase.id} />}
      <label className="col-span-2"><span className="label">De</span><input type="date" name="start_date" defaultValue={phase?.start_date ?? ""} className="!px-1 text-xs" /></label>
      <label className="col-span-2"><span className="label">Até</span><input type="date" name="end_date" defaultValue={phase?.end_date ?? ""} className="!px-1 text-xs" /></label>
      <label className="col-span-2"><span className="label">Base kcal</span><input name="base_kcal" inputMode="numeric" defaultValue={phase?.base_kcal ?? ""} className="num" required /></label>
      <label className="col-span-4"><span className="label">Nota</span><input name="note" defaultValue={phase?.note ?? ""} className="text-xs" /></label>
      <button className="btn btn-sm col-span-1">{phase ? "OK" : "+"}</button>
      {phase ? <button type="button" className="btn btn-danger btn-sm col-span-1" onClick={() => confirm("Apagar fase?") && start(async () => { await deletePhase(phase.id); })}>✕</button> : <span />}
      {err && <p className="col-span-6 text-xs text-bad">{err}</p>}
    </form>
  );
}

export function RaceEditor({ race }: { race?: { id: string; name: string; date: string; distance_m: number; goal: string; result: string; is_main: boolean } }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <form className={`grid grid-cols-6 items-end gap-1 border-b border-line pb-2 ${pending ? "opacity-60" : ""}`} onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); start(async () => { const r = await saveRace(fd); if (!r.ok) setErr(r.message); }); }}>
      {race && <input type="hidden" name="id" value={race.id} />}
      <label className="col-span-6"><span className="label">{race ? "Prova" : "Nova prova"}</span><input name="name" defaultValue={race?.name} required /></label>
      <label className="col-span-2"><span className="label">Data</span><input type="date" name="date" defaultValue={race?.date} className="!px-1 text-xs" required /></label>
      <label className="col-span-1"><span className="label">km</span><input name="distance_km" defaultValue={race ? race.distance_m / 1000 : ""} className="num !px-1" /></label>
      <label className="col-span-1"><span className="label">Objetivo</span><input name="goal" defaultValue={race?.goal} className="num !px-1 text-xs" /></label>
      <label className="col-span-1"><span className="label">Resultado</span><input name="result" defaultValue={race?.result} className="num !px-1 text-xs" /></label>
      <label className="col-span-1 flex items-center gap-1 pb-2 text-xs"><input type="checkbox" name="is_main" defaultChecked={race?.is_main} /> principal</label>
      <button className="btn btn-sm col-span-3">{race ? "Guardar" : "Adicionar"}</button>
      {race && <button type="button" className="btn btn-danger btn-sm col-span-3" onClick={() => confirm("Apagar prova?") && start(async () => { await deleteRace(race.id); })}>Apagar</button>}
      {err && <p className="col-span-6 text-xs text-bad">{err}</p>}
    </form>
  );
}

export function ImportSeed() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <form className="mt-2 space-y-2" onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); setMsg(null); start(async () => { const r = await importSeedFile(fd); setMsg(r.ok ? { ok: true, text: r.data?.summary ?? "Importado." } : { ok: false, text: r.message }); }); }}>
      <input type="file" name="file" accept=".json,application/json" required />
      <button className="btn btn-sm" disabled={pending}>{pending ? "A importar…" : "Importar"}</button>
      {msg && <p className={`text-sm ${msg.ok ? "text-good" : "text-bad"}`}>{msg.text}</p>}
    </form>
  );
}

export function Backfill() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col gap-1">
      <button className="btn btn-ghost btn-sm" disabled={pending} onClick={() => start(async () => { const r = await syncNow("manual", 120); setMsg(r.ok ? `${r.data?.imported ?? 0} registos (últimos 120 dias)` : r.message); })}>
        {pending ? "A importar histórico…" : "Importar histórico do Intervals (120 dias)"}
      </button>
      {msg && <span className="text-xs text-muted">{msg}</span>}
    </span>
  );
}

export function ProbeWellness() {
  const [pending, start] = useTransition();
  const [fields, setFields] = useState<string[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col gap-1">
      <button className="btn btn-ghost btn-sm" disabled={pending} onClick={() => start(async () => { const r = await probeWellness(); if (r.ok) setFields(r.data ?? []); else setErr(r.message); })}>
        Ver campos de wellness disponíveis
      </button>
      {err && <span className="text-xs text-bad">{err}</span>}
      {fields && (
        <span className="text-xs text-muted">
          {fields.length ? fields.join(", ") : "Sem dados nos últimos dias."}
          {fields.length > 0 && (fields.some((f) => /deep|rem|light/i.test(f)) ? " — há fases do sono: são importadas." : " — sem fases do sono: o total e a pontuação vêm do Garmin; as fases introduzem-se à mão no ecrã Hoje.")}
        </span>
      )}
    </span>
  );
}

export function SetPasswordForm() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const fd = new FormData(form);
        start(async () => {
          const r = await setPassword(fd);
          setMsg(r.ok ? { ok: true, text: r.message ?? "Guardada." } : { ok: false, text: r.message });
          if (r.ok) form.reset();
        });
      }}
    >
      <input type="email" autoComplete="username" className="hidden" readOnly />
      <label className="block"><span className="label">Nova password (mín. 8 caracteres)</span><input name="password" type="password" autoComplete="new-password" required /></label>
      <label className="block"><span className="label">Repetir</span><input name="password2" type="password" autoComplete="new-password" required /></label>
      <button className="btn btn-sm" disabled={pending}>{pending ? "A guardar…" : "Guardar password"}</button>
      {msg && <p className={`text-sm ${msg.ok ? "text-good" : "text-bad"}`}>{msg.text}</p>}
    </form>
  );
}
