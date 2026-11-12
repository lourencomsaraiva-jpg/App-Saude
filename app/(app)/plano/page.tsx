import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { addDays, daysBetween, formatDatePt, isISODate, todayInTz, weekStart, weekdayShort } from "@/lib/calc/dates";
import { fmt } from "@/lib/calc/numbers";
import { formatDuration, formatPace } from "@/lib/calc/running";
import { weeklyCompliance } from "@/lib/plan/generate";
import type { PlannedWorkoutRow, RaceRow, StrengthSessionRow } from "@/lib/types";
import { PageHeader, Section } from "@/components/ui";
import { StrengthList } from "@/components/strength-list";
import { AddWorkout, StrengthEditor, WorkoutEditor } from "./client";

const TYPE_COLOR: Record<string, string> = { qualidade: "text-warn", longo: "text-accent", prova: "text-bad", força: "text-muted" };

export default async function PlanoPage({ searchParams }: { searchParams: Promise<{ semana?: string; vista?: string }> }) {
  const sp = await searchParams;
  const { supabase } = await requireUser();
  const today = todayInTz();
  const ws = isISODate(sp.semana) ? weekStart(sp.semana) : weekStart(today);
  const view = sp.vista === "calendario" ? "calendario" : "semana";
  const [{ data: wData }, { data: rData }, { data: sData }, { data: acts }, { data: changes }, { data: pendingReview }] = await Promise.all([
    supabase.from("planned_workouts").select("*").order("date"),
    supabase.from("races").select("*").order("date"),
    supabase.from("strength_sessions").select("*, strength_exercises(*)").order("day_of_week"),
    supabase.from("activities").select("id, local_date, type, distance_m, moving_time_s, duration_s, avg_hr, planned_workout_id"),
    supabase.from("planned_workout_changes").select("*").order("created_at", { ascending: false }).limit(15),
    supabase.from("weekly_reviews").select("id, week_start").eq("status", "pendente").limit(1).maybeSingle(),
  ]);
  const workouts = (wData ?? []) as PlannedWorkoutRow[];
  const sessionById = new Map(((sData ?? []) as StrengthSessionRow[]).map((x) => [x.id, x]));
  const races = (rData ?? []) as RaceRow[];
  const actsByPlanned = new Map((acts ?? []).filter((a) => a.planned_workout_id).map((a) => [a.planned_workout_id as string, a]));
  const compliance = weeklyCompliance(workouts);
  const weekWorkouts = workouts.filter((w) => w.date >= ws && w.date <= addDays(ws, 6));
  const upcoming = races.filter((r) => r.date >= today);

  const statusOf = (w: PlannedWorkoutRow) => (w.status === "planeado" && w.date < today && w.type !== "descanso" && w.type !== "recuperação" ? "não feito" : w.status);

  return (
    <div className="space-y-4">
      <PageHeader title="Plano de treino" subtitle="Até 20/12/2026 · ~80 % fácil / 20 % intenso" />

      {pendingReview && (
        <Link href="/treinador#revisao" className="block rounded-xl border border-accent bg-soft p-3 text-sm">
          Há uma revisão semanal com proposta de ajuste à espera da tua decisão →
        </Link>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        {upcoming.map((r) => (
          <div key={r.id} className="card !p-3">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-semibold">{r.name}</span>
              <span className="num text-xl font-bold text-accent">{daysBetween(today, r.date)} <span className="text-xs font-medium text-muted">dias</span></span>
            </div>
            <div className="num text-xs text-muted">
              {weekdayShort(r.date)} {formatDatePt(r.date, true)} · {fmt(r.distance_m / 1000, 1)} km{r.goal_time_s ? ` · objetivo ${formatDuration(r.goal_time_s)} (${formatPace(r.goal_time_s / 60 / (r.distance_m / 1000))}/km)` : ""}
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <Link href={`/plano?semana=${ws}`} className={`btn btn-sm ${view === "semana" ? "" : "btn-ghost"}`}>Semana</Link>
        <Link href="/plano?vista=calendario" className={`btn btn-sm ${view === "calendario" ? "" : "btn-ghost"}`}>Calendário</Link>
      </div>

      {view === "semana" ? (
        <Section
          title={`Semana de ${formatDatePt(ws)}${weekWorkouts[0]?.phase ? ` · ${weekWorkouts[0].phase}` : ""}`}
          right={
            <span className="flex gap-1">
              <Link href={`/plano?semana=${addDays(ws, -7)}`} className="btn btn-ghost btn-sm" aria-label="Semana anterior">‹</Link>
              <Link href={`/plano?semana=${addDays(ws, 7)}`} className="btn btn-ghost btn-sm" aria-label="Semana seguinte">›</Link>
            </span>
          }
        >
          <ul className="divide-y divide-line">
            {weekWorkouts.map((w) => {
              const done = actsByPlanned.get(w.id);
              const st = statusOf(w);
              return (
                <li key={w.id} className={`py-2.5 ${w.date === today ? "rounded-lg bg-soft px-2" : ""}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs text-muted">{weekdayShort(w.date)} {formatDatePt(w.date)}</div>
                      <div className={`text-sm font-semibold ${TYPE_COLOR[w.type] ?? ""}`}>{w.title}</div>
                      <div className="num text-xs text-muted">
                        {w.distance_km ? `${fmt(Number(w.distance_km), 1)} km` : ""}
                        {w.target_pace_min_s ? ` · ${formatPace(w.target_pace_min_s / 60)}–${formatPace((w.target_pace_max_s ?? w.target_pace_min_s) / 60)}/km` : ""}
                        {w.target_hr_max ? ` · FC ${w.target_hr_min ? `${w.target_hr_min}–` : "< "}${w.target_hr_max}` : ""}
                      </div>
                      {w.type === "força" && w.strength_session_id && sessionById.get(w.strength_session_id) && <StrengthList session={sessionById.get(w.strength_session_id)!} />}
                      {w.structure?.length > 0 && w.type !== "descanso" && !(w.type === "força" && w.strength_session_id) && (
                        <ul className="mt-1 list-disc pl-4 text-xs text-muted">
                          {w.structure.map((s, i) => <li key={i}>{s.repeat ? `${s.repeat} × ` : ""}{s.description}</li>)}
                        </ul>
                      )}
                      {done && (
                        <Link href={`/treinos/${done.id}`} className="num mt-1 inline-block text-xs text-good">
                          Feito: {done.distance_m ? `${fmt(Number(done.distance_m) / 1000, 2)} km` : done.type}
                          {done.distance_m && (done.moving_time_s ?? done.duration_s) ? ` · ${formatPace(Number(done.moving_time_s ?? done.duration_s) / 60 / (Number(done.distance_m) / 1000))}/km` : ""}
                          {done.avg_hr ? ` · FC ${done.avg_hr}` : ""} →
                        </Link>
                      )}
                      {w.change_reason && <div className="mt-1 text-xs italic text-muted">Alterado: {w.change_reason}</div>}
                    </div>
                    <span className={`chip shrink-0 ${st === "feito" ? "text-good" : st === "não feito" || st === "falhado" ? "text-bad" : ""}`}>{st}</span>
                  </div>
                  <WorkoutEditor workout={w} />
                </li>
              );
            })}
            {weekWorkouts.length === 0 && <li className="py-3 text-sm text-muted">Sem treinos planeados nesta semana.</li>}
          </ul>
          <AddWorkout defaultDate={ws < today ? today : ws} />
        </Section>
      ) : (
        <Calendar workouts={workouts} today={today} statusOf={statusOf} />
      )}

      <Section title="Cumprimento por semana">
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {compliance.map((c) => {
            const w = workouts.find((x) => x.week_index === c.week_index);
            return (
              <Link key={c.week_index} href={`/plano?semana=${w ? weekStart(w.date) : ws}`} className="rounded-lg bg-soft p-2 text-center">
                <div className="text-xs text-muted">{w ? formatDatePt(weekStart(w.date)) : `S${c.week_index}`}</div>
                <div className={`num text-lg font-bold ${c.pct >= 80 ? "text-good" : c.pct >= 50 ? "text-warn" : ""}`}>{c.pct}%</div>
                <div className="num text-xs text-muted">{c.done}/{c.planned}</div>
              </Link>
            );
          })}
        </div>
      </Section>

      <Section title="Plano de força (Qua/Sex)">
        <StrengthEditor sessions={(sData ?? []) as StrengthSessionRow[]} />
      </Section>

      {(changes ?? []).length > 0 && (
        <Section title="Histórico de alterações">
          <ul className="space-y-2 text-xs">
            {(changes ?? []).map((c) => (
              <li key={c.id} className="border-b border-line pb-2">
                <span className="text-muted">{new Date(c.created_at).toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" })}</span> · {c.reason}
                <div className="text-muted">{describeChange(c.before, c.after)}</div>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}

function describeChange(before: Record<string, unknown> | null, after: Record<string, unknown> | null) {
  if (!before) return `Adicionado: ${String(after?.title ?? "")} (${String(after?.date ?? "")})`;
  if (!after) return `Removido: ${String(before.title ?? "")} (${String(before.date ?? "")})`;
  return Object.keys(after)
    .filter((k) => k !== "structure")
    .map((k) => `${k}: ${String(before[k] ?? "—")} → ${String(after[k] ?? "—")}`)
    .join(" · ");
}

function Calendar({ workouts, today, statusOf }: { workouts: PlannedWorkoutRow[]; today: string; statusOf: (w: PlannedWorkoutRow) => string }) {
  if (!workouts.length) return null;
  const first = weekStart(workouts[0].date);
  const last = workouts[workouts.length - 1].date;
  const weeks: string[] = [];
  for (let w = first; w <= last; w = addDays(w, 7)) weeks.push(w);
  const byDate = new Map<string, PlannedWorkoutRow[]>();
  for (const w of workouts) byDate.set(w.date, [...(byDate.get(w.date) ?? []), w]);
  const short: Record<string, string> = { descanso: "—", qualidade: "Q", força: "F", fácil: "Fác", longo: "L", prova: "🏁", recuperação: "R" };
  return (
    <Section title="Calendário">
      <div className="grid grid-cols-7 gap-1 text-center text-[11px]">
        {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((d) => <div key={d} className="text-muted">{d}</div>)}
        {weeks.flatMap((ws) =>
          Array.from({ length: 7 }, (_, i) => {
            const d = addDays(ws, i);
            const list = byDate.get(d) ?? [];
            return (
              <Link key={d} href={`/plano?semana=${ws}`} className={`min-h-14 rounded-md border p-1 ${d === today ? "border-accent" : "border-line"}`}>
                <div className="text-muted">{formatDatePt(d)}</div>
                {list.map((w) => {
                  const st = statusOf(w);
                  return (
                    <div key={w.id} className={`num font-semibold ${st === "feito" ? "text-good" : st === "não feito" ? "text-bad" : TYPE_COLOR[w.type] ?? ""}`}>
                      {short[w.type] ?? w.type}
                      {w.distance_km ? ` ${fmt(Number(w.distance_km))}` : ""}
                    </div>
                  );
                })}
              </Link>
            );
          }),
        )}
      </div>
      <p className="mt-2 text-xs text-muted">Q = qualidade · L = longo · F = força · verde = feito · vermelho = não feito.</p>
    </Section>
  );
}
