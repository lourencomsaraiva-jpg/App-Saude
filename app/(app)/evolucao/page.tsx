import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { addDays, formatDatePt, isISODate, todayInTz, weekStart } from "@/lib/calc/dates";
import { fmt } from "@/lib/calc/numbers";
import { formatPace } from "@/lib/calc/running";
import { formatMinutes } from "@/lib/calc/sleep";
import { buildDashboard } from "@/lib/data/dashboard";
import { loadDays } from "@/lib/data/days";
import { loadSettings } from "@/lib/data/settings";
import { DashboardCharts } from "@/components/charts";
import { PageHeader, Section, Stat } from "@/components/ui";

type SP = { periodo?: string; semana?: string; de?: string; ate?: string };

export default async function EvolucaoPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const { supabase } = await requireUser();
  const settings = await loadSettings(supabase);
  const today = todayInTz();
  let start: string;
  let end = today;
  let label: string;
  if (isISODate(sp.semana)) {
    start = weekStart(sp.semana);
    end = addDays(start, 6);
    label = `Semana ${formatDatePt(start)}–${formatDatePt(end)}`;
  } else if (isISODate(sp.de) && isISODate(sp.ate) && sp.de <= sp.ate) {
    start = sp.de;
    end = sp.ate;
    label = `${formatDatePt(start, true)} a ${formatDatePt(end, true)}`;
  } else if (sp.periodo === "tudo") {
    start = settings.profile?.start_date ?? addDays(today, -365);
    label = "Tudo";
  } else {
    const n = [14, 30, 60].includes(Number(sp.periodo)) ? Number(sp.periodo) : 30;
    start = addDays(today, -(n - 1));
    label = `Últimos ${n} dias`;
  }
  const days = await loadDays(supabase, start, end, settings, false);
  const actIds = days.flatMap((d) => d.activities.map((a) => a.id));
  const { data: planned } = actIds.length ? await supabase.from("activities").select("id, planned_workouts(type)").in("id", actIds) : { data: [] };
  const plannedTypeByActivity = new Map<string, string>(((planned ?? []) as unknown as Array<{ id: string; planned_workouts: { type: string } | null }>).filter((p) => p.planned_workouts).map((p) => [p.id, p.planned_workouts!.type]));
  const dash = buildDashboard(days, { plannedTypeByActivity, thresholdHrMin: settings.profile?.threshold_hr_min ?? 162 });
  const k = dash.kpis;
  const thisWeek = weekStart(today);
  const qs = `de=${start}&ate=${end}`;

  return (
    <div className="space-y-4">
      <PageHeader title="Evolução" subtitle={label} />
      <div className="card space-y-3">
        <div className="flex flex-wrap gap-2">
          {[14, 30, 60].map((n) => (
            <Link key={n} href={`/evolucao?periodo=${n}`} className={`btn btn-sm ${label === `Últimos ${n} dias` ? "" : "btn-ghost"}`}>{n} dias</Link>
          ))}
          <Link href="/evolucao?periodo=tudo" className={`btn btn-sm ${label === "Tudo" ? "" : "btn-ghost"}`}>Tudo</Link>
          <Link href={`/evolucao?semana=${thisWeek}`} className="btn btn-ghost btn-sm">Esta semana</Link>
          {isISODate(sp.semana) && (
            <>
              <Link href={`/evolucao?semana=${addDays(start, -7)}`} className="btn btn-ghost btn-sm">‹ Semana</Link>
              <Link href={`/evolucao?semana=${addDays(start, 7)}`} className="btn btn-ghost btn-sm">Semana ›</Link>
            </>
          )}
        </div>
        <form className="flex items-end gap-2" action="/evolucao">
          <label className="flex-1"><span className="label">De</span><input type="date" name="de" defaultValue={start} /></label>
          <label className="flex-1"><span className="label">Até</span><input type="date" name="ate" defaultValue={end} /></label>
          <button className="btn btn-ghost btn-sm">Aplicar</button>
        </form>
      </div>

      <Section>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Stat label="Peso atual" value={k.weight_current !== null ? `${fmt(k.weight_current, 1)} kg` : "—"} sub={k.weight_current_date ? formatDatePt(k.weight_current_date) : undefined} />
          <Stat label="Peso médio" value={k.weight_avg !== null ? `${fmt(k.weight_avg, 1)} kg` : "—"} />
          <Stat label="Calorias médias" value={fmt(k.kcal_avg)} sub={`alvo médio ${fmt(k.target_avg)}`} />
          <Stat label="Saldo médio" value={k.balance_avg !== null ? `${k.balance_avg > 0 ? "+" : ""}${fmt(k.balance_avg)}` : "—"} tone={k.balance_avg !== null && k.balance_avg > 0 ? "warn" : undefined} />
          <Stat label="Gasto estimado médio" value={fmt(k.burn_avg)} sub="base + exercício aj." />
          <Stat label="N.º de treinos" value={k.workouts} sub={`${fmt(k.run_km, 1)} km de corrida`} />
          <Stat label="Calorias em treino" value={fmt(k.exercise_kcal_adj_total)} sub={`bruto ${fmt(k.exercise_kcal_raw_total)}`} />
          <Stat label="Passos médios" value={fmt(k.steps_avg)} />
          <Stat label="Sono médio" value={formatMinutes(k.sleep_avg_min)} />
          <Stat label="Fibra média" value={`${fmt(k.fiber_avg, 1)} g`} sub={`alvo ${fmt(settings.energy.fiberTargetG)} g`} />
          <Stat label="Proteína média" value={`${fmt(k.protein_avg, 1)} g`} sub={`${k.protein_days_on_target}/${k.food_days} dias no alvo`} />
          <Stat label="Hidratos / gordura" value={`${fmt(k.carbs_avg)} / ${fmt(k.fat_avg)} g`} />
        </div>
      </Section>

      <DashboardCharts data={dash} goalWeight={settings.profile?.goal_weight_kg ? Number(settings.profile.goal_weight_kg) : null} />

      <Section title="Resumo semanal">
        <div className="-mx-4 overflow-x-auto px-4">
          <table className="num w-full min-w-[640px] text-xs">
            <thead className="text-muted"><tr className="border-b border-line text-right">
              <th className="py-1.5 text-left">Semana</th><th>Dias</th><th>Peso méd.</th><th>Δ peso</th><th>kcal méd.</th><th>Saldo méd.</th><th>Prot. no alvo</th><th>Treinos</th><th>km</th><th>Sono méd.</th>
            </tr></thead>
            <tbody>
              {dash.weekly.map((w) => (
                <tr key={w.week_start} className="border-b border-line text-right">
                  <td className="py-1.5 text-left"><Link className="text-accent" href={`/evolucao?semana=${w.week_start}`}>{formatDatePt(w.week_start)}</Link></td>
                  <td>{w.days_logged}</td>
                  <td>{fmt(w.weight_avg, 1)}</td>
                  <td className={w.weight_delta !== null && w.weight_delta > 0 ? "text-warn" : ""}>{w.weight_delta === null ? "—" : `${w.weight_delta > 0 ? "+" : ""}${fmt(w.weight_delta, 1)}`}</td>
                  <td>{fmt(w.kcal_avg)}</td>
                  <td>{fmt(w.balance_avg)}</td>
                  <td>{w.protein_days}/{w.days_logged}</td>
                  <td>{w.workouts}</td>
                  <td>{fmt(w.run_km, 1)}</td>
                  <td>{formatMinutes(w.sleep_avg_min)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Tabela detalhada" right={<span className="flex gap-2"><a className="btn btn-ghost btn-sm" href={`/api/export?formato=csv&${qs}`}>CSV</a><a className="btn btn-ghost btn-sm" href={`/api/export?formato=excel&${qs}`}>Excel</a></span>}>
        <div className="-mx-4 max-h-[420px] overflow-auto px-4">
          <table className="num w-full min-w-[720px] text-xs">
            <thead className="sticky top-0 bg-card text-muted"><tr className="border-b border-line text-right">
              <th className="py-1.5 text-left">Data</th><th>Peso</th><th>kcal</th><th>Alvo</th><th>Saldo</th><th>P</th><th>H</th><th>G</th><th>F</th><th>Passos</th><th>Sono</th><th>km</th><th>Ritmo</th>
            </tr></thead>
            <tbody>
              {days.map((d) => (
                <tr key={d.date} className="border-b border-line text-right">
                  <td className="py-1.5 text-left">{formatDatePt(d.date)}</td>
                  <td>{fmt(d.weight_kg, 1)}</td>
                  <td>{d.has_food ? fmt(d.summary.eaten.kcal) : "—"}</td>
                  <td>{fmt(d.summary.target.kcal)}</td>
                  <td>{d.has_food ? fmt(d.summary.balance_kcal) : "—"}</td>
                  <td>{fmt(d.summary.eaten.protein_g, 1)}</td>
                  <td>{fmt(d.summary.eaten.carbs_g, 1)}</td>
                  <td>{fmt(d.summary.eaten.fat_g, 1)}</td>
                  <td>{fmt(d.summary.eaten.fiber_g, 1)}</td>
                  <td>{fmt(d.steps)}</td>
                  <td>{formatMinutes(d.sleep?.total_min)}</td>
                  <td>{fmt(d.run_distance_km, 2)}</td>
                  <td>{d.run_pace ? formatPace(d.run_pace) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}
