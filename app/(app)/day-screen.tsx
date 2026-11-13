import Link from "next/link";
import { addDays, formatDatePt, todayInTz, weekdayLong } from "@/lib/calc/dates";
import { fmt } from "@/lib/calc/numbers";
import { formatPace, formatDuration } from "@/lib/calc/running";
import { formatMinutes } from "@/lib/calc/sleep";
import { requireUser } from "@/lib/auth";
import { loadDays } from "@/lib/data/days";
import { loadSettings } from "@/lib/data/settings";
import type { FoodRow, MealRow, PlannedWorkoutRow, RecipeRow, StrengthSessionRow } from "@/lib/types";
import { StrengthList } from "@/components/strength-list";
import { Bar, Section } from "@/components/ui";
import { SyncButton } from "@/components/sync-button";
import { QuickAdd } from "@/components/day/quick-add";
import { RecentEntries } from "@/components/day/recent-entries";
import { MealList } from "@/components/day/meal-list";
import { DayFields } from "@/components/day/day-fields";

/** Instante de há N horas (fora do render para manter o componente puro). */
function hoursAgo(h: number) {
  return new Date().getTime() - h * 3600_000;
}

export async function DayScreen({ date }: { date: string }) {
  const { supabase } = await requireUser();
  const today = todayInTz();
  const settingsP = loadSettings(supabase);
  const [settings, days, meals, foods, recipes, planned, lastNight] = await Promise.all([
    settingsP,
    loadDays(supabase, date, date, settingsP, false),
    supabase.from("meals").select("*, meal_items(*)").eq("date", date).order("eaten_at", { nullsFirst: false }).order("created_at"),
    supabase.from("foods").select("*").order("is_favorite", { ascending: false }).order("name"),
    supabase.from("recipes").select("*, recipe_items(*)").order("kind").order("name"),
    supabase.from("planned_workouts").select("*, strength_sessions(name, notes, strength_exercises(*))").eq("date", date),
    supabase.from("sleep").select("*").eq("day_date", addDays(date, -1)).maybeSingle(),
  ]);
  const day = days[0];
  // Últimas entradas (2 h) para o cartão de comentário no ecrã Hoje
  const since = hoursAgo(2);
  const recent = date === today
    ? ((meals.data ?? []) as MealRow[]).flatMap((m) =>
        (m.meal_items ?? [])
          .filter((i) => Date.parse((i as unknown as { created_at: string }).created_at) >= since)
          .map((i) => ({ ...i, label: m.label, created_at: (i as unknown as { created_at: string }).created_at })),
      ).sort((a, b) => a.created_at.localeCompare(b.created_at))
    : [];
  const s = day.summary;
  const photoUrls = new Map<string, string>();
  const withPhotos = ((meals.data ?? []) as MealRow[]).filter((m) => m.photo_path);
  if (withPhotos.length) {
    const { data } = await supabase.storage.from("uploads").createSignedUrls(withPhotos.map((m) => m.photo_path!), 3600);
    data?.forEach((d, i) => d.signedUrl && photoUrls.set(withPhotos[i].id, d.signedUrl));
  }
  const phase = settings.phases.filter((p) => (!p.start_date || p.start_date <= date) && (!p.end_date || date <= p.end_date)).sort((a, b) => (a.start_date ?? "") < (b.start_date ?? "") ? 1 : -1)[0];

  const macro = (labelTxt: string, eaten: number | null, target: number, unit = "g") => {
    const left = s.remaining[labelTxt === "Proteína" ? "protein_g" : labelTxt === "Hidratos" ? "carbs_g" : labelTxt === "Gordura" ? "fat_g" : "fiber_g"];
    return (
      <div key={labelTxt}>
        <div className="mb-1 flex items-baseline justify-between text-xs">
          <span className="font-medium">{labelTxt}</span>
          <span className="num text-muted">
            {fmt(eaten ?? 0, 1)} / {fmt(target, 1)} {unit} ·{" "}
            <span className={left < 0 ? "text-bad" : ""}>{left < 0 ? `excedido ${fmt(-left, 1)}` : `falta ${fmt(left, 1)}`}</span>
          </span>
        </div>
        <Bar value={eaten ?? 0} target={target} />
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-2">
        <Link href={`/dia/${addDays(date, -1)}`} className="btn btn-ghost btn-sm" aria-label="Dia anterior">‹</Link>
        <div className="text-center">
          <h1 className="text-lg font-bold capitalize">{date === today ? "Hoje" : weekdayLong(date)}</h1>
          <p className="text-xs text-muted">{formatDatePt(date, true)}{phase?.note ? ` · ${phase.note}` : ""}</p>
        </div>
        {date < today ? <Link href={addDays(date, 1) === today ? "/" : `/dia/${addDays(date, 1)}`} className="btn btn-ghost btn-sm" aria-label="Dia seguinte">›</Link> : <SyncButton compact />}
      </header>

      <Section>
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="label">Comido / alvo</div>
            <div className="num text-2xl font-bold">
              {fmt(s.eaten.kcal)} <span className="text-base font-medium text-muted">/ {fmt(s.target.kcal)} kcal</span>
            </div>
          </div>
          <div className="text-right">
            <div className="label">{s.remaining.kcal < 0 ? "Excedido" : "Falta"}</div>
            <div className={`num text-xl font-semibold ${s.remaining.kcal < 0 ? "text-bad" : "text-accent"}`}>{fmt(Math.abs(s.remaining.kcal))}</div>
          </div>
        </div>
        <div className="mt-2">
          <Bar value={s.eaten.kcal} target={s.target.kcal} />
        </div>
        <div className="mt-4 space-y-3">
          {macro("Proteína", s.eaten.protein_g, s.target.protein_g)}
          {macro("Hidratos", s.eaten.carbs_g, s.target.carbs_g)}
          {macro("Gordura", s.eaten.fat_g, s.target.fat_g)}
          {macro("Fibra", s.eaten.fiber_g, s.target.fiber_g)}
        </div>
        <dl className="num mt-4 grid grid-cols-3 gap-2 border-t border-line pt-3 text-xs">
          <div><dt className="text-muted">Base da fase</dt><dd className="font-semibold">{fmt(s.phase_base_kcal)}</dd></div>
          <div><dt className="text-muted">Exercício (aj.)</dt><dd className="font-semibold">{fmt(s.exercise_kcal_adj)}{s.exercise_kcal_raw !== s.exercise_kcal_adj && <span className="font-normal text-muted"> ({fmt(s.exercise_kcal_raw)})</span>}</dd></div>
          <div><dt className="text-muted">Saldo</dt><dd className={`font-semibold ${s.balance_kcal > 0 ? "text-warn" : ""}`}>{s.balance_kcal > 0 ? "+" : ""}{fmt(s.balance_kcal)}</dd></div>
        </dl>
      </Section>

      {recent.length > 0 && (
        <RecentEntries
          stamp={recent[recent.length - 1].created_at}
          s={{
            date,
            label: `últimas 2 h · ${[...new Set(recent.map((r) => r.label))].join(", ")}`,
            items: recent.map((r) => ({ description: r.description, kcal: Number(r.kcal), protein_g: r.protein_g, carbs_g: r.carbs_g, fat_g: r.fat_g, fiber_g: r.fiber_g })),
            eaten: day.summary.eaten,
            target: { kcal: day.summary.target.kcal, protein_g: day.summary.target.protein_g, carbs_g: day.summary.target.carbs_g, fat_g: day.summary.target.fat_g, fiber_g: day.summary.target.fiber_g },
            remaining: day.summary.remaining,
          }}
        />
      )}

      <QuickAdd date={date} foods={(foods.data ?? []) as FoodRow[]} recipes={(recipes.data ?? []) as RecipeRow[]} />

      <MealList date={date} meals={((meals.data ?? []) as MealRow[]).map((m) => ({ ...m, photo_url: photoUrls.get(m.id) ?? null }))} />

      <Section title="Treino" right={<Link href="/plano" className="text-xs text-accent">Plano</Link>}>
        {(planned.data ?? []).length === 0 && day.activities.length === 0 && <p className="text-sm text-muted">Nada planeado.</p>}
        {((planned.data ?? []) as PlannedWorkoutRow[]).map((w) => (
          <div key={w.id} className="mb-2 flex items-start justify-between gap-2 text-sm">
            <div>
              <span className="chip mr-2">Planeado</span>
              <span className="font-medium">{w.title}</span>
              {w.target_pace_min_s && <span className="text-muted"> · {formatPace(w.target_pace_min_s / 60)}–{formatPace((w.target_pace_max_s ?? w.target_pace_min_s) / 60)}/km</span>}
              {w.target_hr_max && <span className="text-muted"> · FC &lt; {w.target_hr_max}</span>}
              {w.type === "força" && (w as PlannedWorkoutRow & { strength_sessions: StrengthSessionRow | null }).strength_sessions && (
                <StrengthList session={(w as PlannedWorkoutRow & { strength_sessions: StrengthSessionRow }).strength_sessions} />
              )}
            </div>
            <span className={`chip shrink-0 ${w.status === "feito" ? "text-good" : ""}`}>{w.status}</span>
          </div>
        ))}
        {day.activities.map((a) => (
          <Link key={a.id} href={`/treinos/${a.id}`} className="mt-1 block rounded-lg bg-soft p-2 text-sm">
            <span className="chip mr-2 bg-card">Feito</span>
            <span className="font-medium capitalize">{a.name || a.type}</span>
            <span className="num text-muted">
              {a.distance_m ? ` · ${fmt(Number(a.distance_m) / 1000, 2)} km` : ""}
              {a.pace && a.type === "corrida" ? ` · ${formatPace(a.pace)}/km` : ""}
              {a.avg_hr ? ` · FC ${a.avg_hr}` : ""}
              {a.moving_time_s || a.duration_s ? ` · ${formatDuration(Number(a.moving_time_s ?? a.duration_s))}` : ""}
              {a.kcal_raw ? ` · ${fmt(Number(a.kcal_raw))} kcal` : ""}
            </span>
          </Link>
        ))}
      </Section>

      <DayFields
        date={date}
        weight={day.weight_kg}
        weightSource={day.weight_source}
        steps={day.steps}
        notes={day.notes}
        sleepText={lastNight.data ? sleepToText(lastNight.data) : ""}
        sleepSource={lastNight.data?.source ?? null}
        sleepScore={lastNight.data?.score ?? null}
        sleepDayDate={addDays(date, -1)}
        sleepSummary={lastNight.data ? `${formatMinutes(lastNight.data.total_min)}${lastNight.data.score ? ` · pontuação ${lastNight.data.score}` : ""}` : null}
        restingHr={day.resting_hr}
        hrv={day.hrv}
      />
    </div>
  );
}

function sleepToText(s: { total_min: number | null; deep_min: number | null; light_min: number | null; rem_min: number | null; awake_min: number | null }) {
  const parts = [
    s.deep_min !== null && `profundo ${formatMinutes(s.deep_min)}`,
    s.light_min !== null && `leve ${formatMinutes(s.light_min)}`,
    s.rem_min !== null && `REM ${formatMinutes(s.rem_min)}`,
    s.awake_min !== null && `acordado ${s.awake_min}min`,
  ].filter(Boolean);
  return `${formatMinutes(s.total_min)}${parts.length ? ` (${parts.join(", ")})` : ""}`;
}
