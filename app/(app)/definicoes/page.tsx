import { requireUser } from "@/lib/auth";
import { formatDatePt } from "@/lib/calc/dates";
import { fmt } from "@/lib/calc/numbers";
import { formatDuration, formatPace } from "@/lib/calc/running";
import { loadSettings } from "@/lib/data/settings";
import type { RaceRow } from "@/lib/types";
import { PageHeader, Section } from "@/components/ui";
import { SyncButton } from "@/components/sync-button";
import { Backfill, ImportSeed, PhaseRowEditor, ProbeWellness, ProfileForm, RaceEditor, SetPasswordForm } from "./client";

export default async function DefinicoesPage() {
  const { supabase, user } = await requireUser();
  const settings = await loadSettings(supabase);
  const [{ data: logs }, { data: races }, { count: actCount }] = await Promise.all([
    supabase.from("sync_log").select("*").order("started_at", { ascending: false }).limit(10),
    supabase.from("races").select("*").order("date"),
    supabase.from("activities").select("id", { count: "exact", head: true }).eq("source", "intervals"),
  ]);
  const p = settings.profile!;
  const intervalsOk = !!process.env.INTERVALS_ATHLETE_ID && !!process.env.INTERVALS_API_KEY;
  const lastOk = (logs ?? []).find((l) => l.source === "intervals" && (l.status === "ok" || l.status === "partial"));
  const lastErr = (logs ?? []).find((l) => l.error);
  const t = (s: number | null) => (s ? formatDuration(s) : "");
  const pace = (s: number | null) => (s ? formatPace(s / 60) : "");

  return (
    <div className="space-y-4">
      <PageHeader title="Definições" subtitle={user.email} />

      <Section title="Password de entrada">
        <p className="mb-2 text-xs text-muted">Define uma password para entrares sem precisar de emails (também na app instalada no ecrã principal).</p>
        <SetPasswordForm />
      </Section>

      <Section title="Ligação Garmin (via Intervals.icu)" right={<SyncButton compact />}>
        <dl className="num grid grid-cols-2 gap-2 text-sm">
          <dt className="text-muted">Estado</dt><dd className={intervalsOk ? "text-good" : "text-bad"}>{intervalsOk ? "Configurado" : "Falta INTERVALS_ATHLETE_ID / INTERVALS_API_KEY"}</dd>
          <dt className="text-muted">Última sincronização</dt><dd>{lastOk ? new Date(lastOk.finished_at ?? lastOk.started_at).toLocaleString("pt-PT", { timeZone: process.env.APP_TIMEZONE || "Europe/Lisbon", dateStyle: "short", timeStyle: "short" }) : "—"}</dd>
          <dt className="text-muted">Treinos importados</dt><dd>{actCount ?? 0}</dd>
          <dt className="text-muted">Último erro</dt><dd className="text-bad break-words">{lastErr?.error?.slice(0, 200) ?? "—"}</dd>
        </dl>
        <div className="-mx-4 mt-3 overflow-x-auto px-4">
          <table className="num w-full text-xs">
            <thead className="text-muted"><tr className="border-b border-line text-left"><th className="py-1">Quando</th><th>Fonte</th><th>Origem</th><th>Estado</th><th className="text-right">Registos</th></tr></thead>
            <tbody>
              {(logs ?? []).map((l) => (
                <tr key={l.id} className="border-b border-line">
                  <td className="py-1">{new Date(l.started_at).toLocaleString("pt-PT", { timeZone: process.env.APP_TIMEZONE || "Europe/Lisbon", dateStyle: "short", timeStyle: "short" })}</td>
                  <td>{l.source}</td><td>{l.trigger}</td>
                  <td className={l.status === "error" ? "text-bad" : l.status === "partial" ? "text-warn" : "text-good"} title={l.error ?? ""}>{l.status}</td>
                  <td className="text-right">{l.imported_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Backfill />
          <ProbeWellness />
        </div>
        <p className="mt-2 text-xs text-muted">Sincroniza de hora a hora (cron), ao abrir a app e com o botão. Valores manuais nunca são substituídos.</p>
      </Section>

      <Section title="Perfil, objetivos, zonas e alvos">
        <ProfileForm
          v={{
            name: p.name, age: p.age, height_cm: p.height_cm, start_weight_kg: p.start_weight_kg, start_date: p.start_date, goal_weight_kg: p.goal_weight_kg,
            goal_10k_s: t(p.goal_10k_s), goal_hm_s: t(p.goal_hm_s), pb_10k_pace_s: pace(p.pb_10k_pace_s), pb_hm_s: t(p.pb_hm_s),
            easy_pace_min_s: pace(p.easy_pace_min_s), easy_pace_max_s: pace(p.easy_pace_max_s), easy_hr_max: p.easy_hr_max, threshold_hr_min: p.threshold_hr_min, threshold_hr_max: p.threshold_hr_max, max_hr: p.max_hr,
            base_burn_kcal: p.base_burn_kcal, protein_target_g: p.protein_target_g, fiber_target_g: p.fiber_target_g, rest_base_kcal: p.rest_base_kcal, rest_carbs_g: p.rest_carbs_g, rest_fat_g: p.rest_fat_g,
            ratio_ref_kcal: p.ratio_ref_kcal, ratio_carbs_g: p.ratio_carbs_g, ratio_fat_g: p.ratio_fat_g, exercise_factor: p.exercise_factor, exercise_factor_start: p.exercise_factor_start,
          }}
        />
      </Section>

      <Section title="Fases calóricas">
        <p className="mb-2 text-xs text-muted">Alvo do dia = base da fase + exercício ajustado. Quando várias fases cobrem a mesma data, ganha a mais curta (ex.: exceção de um dia).</p>
        <div className="space-y-2">
          {settings.phases.map((ph) => <PhaseRowEditor key={ph.id} phase={ph} />)}
          <PhaseRowEditor />
        </div>
      </Section>

      <Section title="Provas">
        <div className="space-y-2">
          {((races ?? []) as RaceRow[]).map((r) => <RaceEditor key={r.id} race={{ ...r, goal: t(r.goal_time_s), result: t(r.result_time_s) }} />)}
          <RaceEditor />
        </div>
      </Section>

      <Section title="Dados">
        <div className="flex flex-wrap gap-2">
          <a className="btn btn-ghost btn-sm" href="/api/export?formato=json">Exportar tudo (JSON)</a>
          <a className="btn btn-ghost btn-sm" href="/api/export?formato=csv&dias=tudo">Diário (CSV)</a>
          <a className="btn btn-ghost btn-sm" href="/api/export?formato=excel&dias=tudo">Diário (Excel)</a>
        </div>
        <h3 className="mt-4 text-sm font-semibold">Importar histórico (seed_entries.json)</h3>
        <ImportSeed />
        <p className="mt-2 text-xs text-muted">Cria os dias, o sono, uma refeição &quot;Histórico importado&quot; por dia e uma atividade por dia. Pode ser repetido sem duplicar. No fim verifica que os totais e saldos coincidem com o ficheiro.</p>
      </Section>

      <Section title="Conta">
        <p className="mb-2 text-xs text-muted">Gasto base atual {fmt(settings.energy.baseBurnKcal)} kcal · fator de exercício {fmt(settings.energy.exerciseFactor, 2)} desde {formatDatePt(settings.energy.exerciseFactorStart, true)}.</p>
        <form action="/auth/signout" method="post"><button className="btn btn-danger btn-sm">Terminar sessão</button></form>
      </Section>
    </div>
  );
}
