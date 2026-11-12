import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { addDays, formatDatePt, weekdayLong } from "@/lib/calc/dates";
import { fmt } from "@/lib/calc/numbers";
import { cardiacCost, compassPt, formatDuration, formatPace, paceFromDistance } from "@/lib/calc/running";
import type { ActivityRow, LapRow, PlannedWorkoutRow } from "@/lib/types";
import { Markdown } from "@/components/markdown";
import { PageHeader, Section, Stat } from "@/components/ui";
import { ActivityNotes, AnalyzeButton, DeleteActivity } from "./client";

export default async function ActivityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireUser();
  const { data } = await supabase.from("activities").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const a = data as ActivityRow;
  const [{ data: lapsData }, { data: plannedData }, { data: similarData }] = await Promise.all([
    supabase.from("activity_laps").select("*").eq("activity_id", id).order("idx"),
    a.planned_workout_id ? supabase.from("planned_workouts").select("*").eq("id", a.planned_workout_id).maybeSingle() : supabase.from("planned_workouts").select("*").eq("date", a.local_date).limit(1).maybeSingle(),
    supabase.from("activities").select("*").eq("type", a.type).neq("id", id).gte("local_date", addDays(a.local_date, -120)).lte("local_date", a.local_date).order("local_date", { ascending: false }).limit(60),
  ]);
  const laps = ((lapsData ?? []) as LapRow[]).filter((l) => l.kind === "lap");
  const splits = ((lapsData ?? []) as LapRow[]).filter((l) => l.kind === "km_split");
  const planned = plannedData as PlannedWorkoutRow | null;
  const time = Number(a.moving_time_s ?? a.duration_s ?? 0) || null;
  const pace = paceFromDistance(a.distance_m, time);
  const cc = a.type === "corrida" ? cardiacCost(a.avg_hr, pace) : null;
  const dist = Number(a.distance_m ?? 0);
  const similar = ((similarData ?? []) as ActivityRow[])
    .filter((s) => (dist ? Math.abs(Number(s.distance_m ?? 0) - dist) / dist <= 0.25 : true))
    .slice(0, 6)
    .map((s) => {
      const p = paceFromDistance(s.distance_m, s.moving_time_s ?? s.duration_s);
      return { ...s, pace: p, cc: cardiacCost(s.avg_hr, p) };
    });

  const paceOk = planned?.target_pace_min_s && pace ? pace * 60 >= planned.target_pace_min_s - 5 && pace * 60 <= (planned.target_pace_max_s ?? planned.target_pace_min_s) + 5 : null;
  const hrOk = planned?.target_hr_max && a.avg_hr ? a.avg_hr <= planned.target_hr_max : null;

  const lapTable = (rows: LapRow[], title: string) =>
    rows.length > 0 && (
      <Section title={title}>
        <div className="-mx-4 overflow-x-auto px-4">
          <table className="num w-full text-xs">
            <thead className="text-muted"><tr className="border-b border-line text-right">
              <th className="py-1.5 text-left">#</th><th>Dist.</th><th>Tempo</th><th>Ritmo</th><th>FC</th><th>Máx</th><th>↑</th><th>↓</th>{rows.some((r) => r.bearing_deg !== null) && <th>Rumo</th>}
            </tr></thead>
            <tbody>
              {rows.map((r) => {
                const p = paceFromDistance(r.distance_m, r.duration_s);
                const over = planned?.target_hr_max && r.avg_hr && r.avg_hr > planned.target_hr_max && planned.type !== "qualidade";
                return (
                  <tr key={r.id} className="border-b border-line text-right">
                    <td className="py-1.5 text-left">{r.idx}{r.label ? <span className="ml-1 text-muted">{r.label}</span> : null}</td>
                    <td>{r.distance_m ? fmt(Number(r.distance_m) / 1000, 2) : "—"}</td>
                    <td>{formatDuration(r.duration_s)}</td>
                    <td className="font-semibold">{formatPace(p)}</td>
                    <td className={over ? "text-bad" : ""}>{r.avg_hr ?? "—"}</td>
                    <td>{r.max_hr ?? "—"}</td>
                    <td>{r.ascent_m !== null ? fmt(Number(r.ascent_m)) : "—"}</td>
                    <td>{r.descent_m !== null ? fmt(Number(r.descent_m)) : "—"}</td>
                    {rows.some((x) => x.bearing_deg !== null) && <td>{r.bearing_deg !== null ? `${compassPt(r.bearing_deg)} ${r.bearing_deg}°` : "—"}</td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>
    );

  return (
    <div className="space-y-4">
      <PageHeader title={a.name || a.type} subtitle={<span className="capitalize">{weekdayLong(a.local_date)}, {formatDatePt(a.local_date, true)} · {a.type} · {a.source === "seed" ? "histórico" : a.source}</span>} right={<Link href="/treinos" className="btn btn-ghost btn-sm">Treinos</Link>} />
      <Section>
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Distância" value={dist ? `${fmt(dist / 1000, 2)} km` : "—"} />
          <Stat label="Tempo" value={formatDuration(time)} />
          <Stat label="Ritmo" value={pace ? `${formatPace(pace)}` : "—"} sub="min/km" />
          <Stat label="FC média / máx" value={`${a.avg_hr ?? "—"} / ${a.max_hr ?? "—"}`} tone={hrOk === false ? "bad" : undefined} />
          <Stat label="Custo cardíaco" value={cc !== null ? fmt(cc, 1) : "—"} sub="FC × ritmo ÷ 10" />
          <Stat label="kcal Garmin" value={a.kcal_raw ? fmt(Number(a.kcal_raw)) : "—"} />
          <Stat label="Subida / descida" value={`${a.ascent_m !== null ? fmt(Number(a.ascent_m)) : "—"} / ${a.descent_m !== null ? fmt(Number(a.descent_m)) : "—"} m`} />
          <Stat label="Efeito de treino" value={a.training_effect !== null ? fmt(Number(a.training_effect), 1) : "—"} />
          <Stat label="Carga" value={a.training_load !== null ? fmt(Number(a.training_load)) : "—"} />
        </div>
      </Section>

      {planned && (
        <Section title="Planeado vs realizado">
          <p className="text-sm font-medium">{planned.title}</p>
          <ul className="mt-2 space-y-1 text-sm">
            {planned.distance_km && <li>Distância: {fmt(Number(planned.distance_km), 1)} km planeados · {fmt(dist / 1000, 2)} feitos</li>}
            {planned.target_pace_min_s && (
              <li className={paceOk === false ? "text-warn" : ""}>Ritmo-alvo {formatPace(planned.target_pace_min_s / 60)}–{formatPace((planned.target_pace_max_s ?? planned.target_pace_min_s) / 60)}/km · feito {formatPace(pace)}/km {paceOk === null ? "" : paceOk ? "✓" : "✗"}</li>
            )}
            {planned.target_hr_max && <li className={hrOk === false ? "text-bad" : ""}>FC-alvo &lt; {planned.target_hr_max} · média {a.avg_hr ?? "—"}, máx {a.max_hr ?? "—"} {hrOk === null ? "" : hrOk ? "✓" : "✗"}</li>}
          </ul>
          {planned.structure?.length > 0 && <ul className="mt-2 list-disc pl-5 text-xs text-muted">{planned.structure.map((s, i) => <li key={i}>{s.repeat ? `${s.repeat} × ` : ""}{s.description}</li>)}</ul>}
        </Section>
      )}

      <Section title="Análise do treinador" right={<AnalyzeButton id={a.id} hasAnalysis={!!a.ai_analysis} />}>
        {a.ai_analysis ? <Markdown>{a.ai_analysis}</Markdown> : <p className="text-sm text-muted">Ainda sem análise.</p>}
      </Section>

      {lapTable(splits, "Parciais por km")}
      {lapTable(laps, "Voltas / intervalos")}

      {similar.length > 0 && (
        <Section title="Treinos semelhantes (±25 % distância)">
          <table className="num w-full text-xs">
            <thead className="text-muted"><tr className="border-b border-line text-right"><th className="py-1.5 text-left">Data</th><th>km</th><th>Ritmo</th><th>FC</th><th>CC</th></tr></thead>
            <tbody>
              <tr className="border-b border-line text-right font-semibold"><td className="py-1.5 text-left">Este</td><td>{fmt(dist / 1000, 1)}</td><td>{formatPace(pace)}</td><td>{a.avg_hr ?? "—"}</td><td>{cc !== null ? fmt(cc, 1) : "—"}</td></tr>
              {similar.map((s) => (
                <tr key={s.id} className="border-b border-line text-right">
                  <td className="py-1.5 text-left"><Link href={`/treinos/${s.id}`} className="text-accent">{formatDatePt(s.local_date)}</Link></td>
                  <td>{s.distance_m ? fmt(Number(s.distance_m) / 1000, 1) : "—"}</td><td>{formatPace(s.pace)}</td><td>{s.avg_hr ?? "—"}</td><td>{s.cc !== null ? fmt(s.cc, 1) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-muted">Custo cardíaco mais baixo ao mesmo ritmo = melhor eficiência aeróbica.</p>
        </Section>
      )}

      <Section title="Condições e sensação">
        <ActivityNotes id={a.id} conditions={a.conditions} feel={a.feel} />
      </Section>
      {a.source !== "intervals" && <DeleteActivity id={a.id} />}
    </div>
  );
}
