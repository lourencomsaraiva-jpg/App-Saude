import Link from "next/link";
import { addDays, formatDatePt, hourInTz, todayInTz, weekdayLong } from "@/lib/calc/dates";
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
import { CoachCard } from "@/components/day/coach-card";
import { mealLine, planMeals, trainingLines, type PlanFood } from "@/lib/coach/day-plan";
import { foodComment, workoutComment } from "@/lib/coach/comments";
import { sumNutrients } from "@/lib/calc/nutrition";
import { cardiacCost, paceFromDistance } from "@/lib/calc/running";
import { MealList } from "@/components/day/meal-list";
import { DayFields } from "@/components/day/day-fields";

/** Hora local atual (fora do render para manter o componente puro). */
function currentHour(tz: string) {
  return hourInTz(new Date(), tz);
}

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

  // ---- comentários do treinador (regras, sem IA)
  const runIds = day.activities.filter((a) => a.type === "corrida").map((a) => a.id);
  const [tomorrowQ, lapsQ, similarQ] = await Promise.all([
    supabase.from("planned_workouts").select("type, title").eq("date", addDays(date, 1)).neq("type", "descanso").limit(1).maybeSingle(),
    runIds.length ? supabase.from("activity_laps").select("activity_id, distance_m, duration_s, avg_hr").eq("kind", "km_split").in("activity_id", runIds).order("idx") : Promise.resolve({ data: [] }),
    runIds.length
      ? supabase.from("activities").select("id, distance_m, moving_time_s, duration_s, avg_hr").eq("type", "corrida").gte("local_date", addDays(date, -60)).lt("local_date", date)
      : Promise.resolve({ data: [] }),
  ]);
  const tomorrow = (tomorrowQ.data as { type: string; title: string } | null) ?? null;
  const plannedList = (planned.data ?? []) as PlannedWorkoutRow[];
  const todayRun = plannedList.find((w) => w.type !== "força" && w.type !== "descanso") ?? null;
  const tz = process.env.APP_TIMEZONE || "Europe/Lisbon";
  const foodTips = recent.length
    ? foodComment({
        hour: hourInTz(new Date(recent[recent.length - 1].created_at), tz),
        entry: sumNutrients(recent.map((r) => ({ kcal: Number(r.kcal), protein_g: r.protein_g, carbs_g: r.carbs_g, fat_g: r.fat_g, fiber_g: r.fiber_g }))),
        remaining: s.remaining,
        target: { kcal: s.target.kcal, protein_g: s.target.protein_g },
        todayWorkout: todayRun ? { type: todayRun.type, title: todayRun.title, done: todayRun.status === "feito" } : null,
        tomorrowWorkout: tomorrow,
        assessOnly: true,
        phaseNote: settings.phases.find((p) => (!p.start_date || p.start_date <= date) && (!p.end_date || date <= p.end_date) && /carga/i.test(p.note ?? ""))?.note ?? null,
      })
    : [];
  const lapsBy = new Map<string, Array<{ pace: number | null; avgHr: number | null }>>();
  for (const l of (lapsQ.data ?? []) as Array<{ activity_id: string; distance_m: number | null; duration_s: number | null; avg_hr: number | null }>) {
    lapsBy.set(l.activity_id, [...(lapsBy.get(l.activity_id) ?? []), { pace: paceFromDistance(Number(l.distance_m), Number(l.duration_s)), avgHr: l.avg_hr }]);
  }
  const workoutTips = new Map<string, string[]>();
  for (const a of day.activities) {
    const pl = plannedList.find((w) => w.id === a.planned_workout_id) ?? (a.type === "força" ? plannedList.find((w) => w.type === "força") : todayRun) ?? null;
    const dist = a.distance_m ? Number(a.distance_m) : 0;
    const similar = ((similarQ.data ?? []) as Array<{ distance_m: number | null; moving_time_s: number | null; duration_s: number | null; avg_hr: number | null }>)
      .filter((x) => dist && x.distance_m && Math.abs(Number(x.distance_m) - dist) / dist <= 0.25 && x.avg_hr)
      .map((x) => cardiacCost(x.avg_hr, paceFromDistance(Number(x.distance_m), Number(x.moving_time_s ?? x.duration_s))))
      .filter((x): x is number => x !== null);
    workoutTips.set(
      a.id,
      workoutComment({
        type: a.type,
        distanceKm: dist ? dist / 1000 : null,
        pace: a.pace,
        avgHr: a.avg_hr,
        maxHr: a.max_hr,
        cardiacCost: a.cardiac_cost,
        planned: pl ? { type: pl.type, title: pl.title, distanceKm: pl.distance_km === null ? null : Number(pl.distance_km), paceMinS: pl.target_pace_min_s, paceMaxS: pl.target_pace_max_s, hrMax: pl.target_hr_max } : null,
        splits: lapsBy.get(a.id) ?? [],
        similarCardiacCost: similar.length >= 2 ? similar.reduce((x, y) => x + y, 0) / similar.length : null,
        easyHrMax: settings.profile?.easy_hr_max ?? 150,
        tomorrow,
      }),
    );
  }

  // "O que vi" + "Até ao fim do dia" (só no dia de hoje)
  const nowHour = currentHour(tz);
  const recentActs = day.activities.filter((a) => a.created_at && Date.parse(a.created_at) >= since);
  const seen = [...foodTips, ...recentActs.flatMap((a) => (workoutTips.get(a.id) ?? []).slice(0, 3).map((t) => `${a.type === "força" ? "Força" : "Treino"}: ${t}`))];
  const plan = planMeals(nowHour, s.remaining, ((foods.data ?? []) as PlanFood[]).map((f) => ({ ...f, kcal: Number(f.kcal), protein_g: Number(f.protein_g), carbs_g: Number(f.carbs_g), fat_g: Number(f.fat_g), fiber_g: Number(f.fiber_g), serving_g: f.serving_g === null ? null : Number(f.serving_g) })));
  const foodPlan = plan.meals.length ? plan.meals.map(mealLine) : s.remaining.kcal < 60 ? ["Alvo de calorias cumprido: não precisas de comer mais hoje."] : [];
  const foodAfter = plan.meals.length ? `Depois disto: ${plan.after.kcal >= 0 ? `sobram ≈${fmt(plan.after.kcal)} kcal` : `passas ≈${fmt(-plan.after.kcal)} kcal`} · proteína ${plan.after.protein_g > 0 ? `falta ${fmt(plan.after.protein_g)} g` : "cumprida"} · fibra ${plan.after.fiber_g > 0 ? `falta ${fmt(plan.after.fiber_g)} g` : "cumprida"}.` : null;
  const training = trainingLines({
    hour: nowHour,
    today: plannedList.map((w) => ({ type: w.type, title: w.title, status: w.status, firstStep: w.type === "força" ? "~25 min" : w.distance_km ? `≈${fmt(Number(w.distance_km), 1)} km` : null })),
    doneTypes: day.activities.map((a) => a.type),
    tomorrow,
    steps: day.steps,
  });
  const coachPrompt = `Usa o conector Treino & Nutrição. Revê o meu dia de hoje e este plano para o resto do dia:\n${[...foodPlan, ...training].map((l) => `- ${l}`).join("\n")}\nAjusta o que achares melhor, como meu treinador e nutricionista.`;

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

      {date === today && (
        <CoachCard
          seen={seen}
          foodPlan={foodPlan}
          foodAfter={foodAfter}
          training={training}
          prompt={coachPrompt}
          numbers={recent.length ? {
            date,
            label: `últimas 2 h · ${[...new Set(recent.map((r) => r.label))].join(", ")}`,
            items: recent.map((r) => ({ description: r.description, kcal: Number(r.kcal), protein_g: r.protein_g, carbs_g: r.carbs_g, fat_g: r.fat_g, fiber_g: r.fiber_g })),
            eaten: day.summary.eaten,
            target: { kcal: day.summary.target.kcal, protein_g: day.summary.target.protein_g, carbs_g: day.summary.target.carbs_g, fat_g: day.summary.target.fat_g, fiber_g: day.summary.target.fiber_g },
            remaining: day.summary.remaining,
          } : null}
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
          <div key={a.id}>
          <Link href={`/treinos/${a.id}`} className="mt-1 block rounded-lg bg-soft p-2 text-sm">
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
          {(workoutTips.get(a.id) ?? []).length > 0 && (
            <div className="mt-2 rounded-lg border border-accent/40 p-2 text-sm">
              <div className="mb-1 text-xs font-semibold text-accent">Treinador</div>
              <ul className="space-y-1">{workoutTips.get(a.id)!.map((t, i) => <li key={i}>{t}</li>)}</ul>
            </div>
          )}
          </div>
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
