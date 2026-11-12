"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addManualActivity, uploadFit } from "../actions";
import { todayInTz } from "@/lib/calc/dates";

export function FitUpload() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        start(async () => {
          const r = await uploadFit(f);
          if (r.ok && r.data) router.push(`/treinos/${r.data.id}`);
          else setMsg(r.ok ? null : r.message);
        });
      }}
    >
      <input type="file" name="file" accept=".fit,.FIT,application/octet-stream" required />
      <button className="btn w-full" disabled={pending}>{pending ? "A processar…" : "Carregar"}</button>
      {msg && <p className="text-sm text-bad">{msg}</p>}
      <p className="text-xs text-muted">Calcula voltas, parciais de 1 km e rumo por km (útil para o vento). Não duplica: o mesmo ficheiro substitui o anterior.</p>
    </form>
  );
}

export function ManualActivity() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <form
      className="grid grid-cols-2 gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const f = new FormData(form);
        start(async () => {
          const r = await addManualActivity(f);
          setMsg(r.ok ? { ok: true, text: "Treino adicionado." } : { ok: false, text: r.message });
          if (r.ok) form.reset();
        });
      }}
    >
      <label className="col-span-1"><span className="label">Data</span><input type="date" name="date" defaultValue={todayInTz()} required /></label>
      <label><span className="label">Tipo</span>
        <select name="type" defaultValue="corrida">
          {["corrida", "força", "bicicleta", "caminhada", "natação", "outro"].map((t) => <option key={t}>{t}</option>)}
        </select>
      </label>
      <label className="col-span-2"><span className="label">Nome</span><input name="name" placeholder="Opcional" /></label>
      <label><span className="label">Distância (km)</span><input name="distance_km" inputMode="decimal" /></label>
      <label><span className="label">Duração (h:mm:ss)</span><input name="duration" placeholder="52:32" /></label>
      <label><span className="label">FC média</span><input name="avg_hr" inputMode="numeric" /></label>
      <label><span className="label">FC máx.</span><input name="max_hr" inputMode="numeric" /></label>
      <label><span className="label">kcal (Garmin)</span><input name="kcal_raw" inputMode="numeric" /></label>
      <label><span className="label">Subida (m)</span><input name="ascent_m" inputMode="numeric" /></label>
      <button className="btn col-span-2" disabled={pending}>Adicionar</button>
      {msg && <p className={`col-span-2 text-sm ${msg.ok ? "text-good" : "text-bad"}`}>{msg.text}</p>}
    </form>
  );
}
