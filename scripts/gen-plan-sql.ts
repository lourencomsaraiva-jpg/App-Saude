/** Gera supabase/manual/plano-corrida.sql a partir de lib/plan/athlete-plan.ts. */
import { writeFileSync } from "node:fs";
import { buildAthletePlan } from "../lib/plan/athlete-plan";

const q = (v: string | number | null | undefined) => (v === null || v === undefined ? "null" : typeof v === "number" ? String(v) : `'${v.replace(/'/g, "''")}'`);
const rows = buildAthletePlan();
const values = rows
  .map(
    (w) =>
      `  (${q(w.date)}::date, ${q(w.phase)}, ${w.week_index}, ${q(w.type)}, ${q(w.title)}, ${w.distance_km === null ? "null" : w.distance_km}, ${q(w.target_pace_min_s)}, ${q(w.target_pace_max_s)}, ${q(w.target_hr_max)}, ${q(JSON.stringify(w.structure))}::jsonb, ${w.strength_day === undefined ? "null" : w.strength_day})`,
  )
  .join(",\n");

const sql = `-- Substitui o plano de treino pelo "Plano de Treino (Ajustado) Agosto — Dezembro 2026" do atleta.
-- Correr uma vez no SQL Editor do Supabase (pode repetir-se). Liga de novo os treinos já feitos ao dia do plano.
begin;

insert into public.races (user_id, name, date, distance_m, result_time_s, is_main)
select p.user_id, 'Meia Maratona de Lisboa (Hyundai Half)', '2026-10-11', 21097, 5784, false from public.profile p
where not exists (select 1 from public.races r where r.user_id = p.user_id and r.date = '2026-10-11');

insert into public.plans (user_id, name, start_date, end_date)
select p.user_id, 'Plano de Treino (Ajustado) Ago–Dez 2026', '2026-08-24', '2026-12-20' from public.profile p
where not exists (select 1 from public.plans x where x.user_id = p.user_id);
update public.plans set name = 'Plano de Treino (Ajustado) Ago–Dez 2026', start_date = '2026-08-24', end_date = '2026-12-20';

delete from public.planned_workouts;

insert into public.planned_workouts (user_id, plan_id, date, phase, week_index, type, title, distance_km, target_pace_min_s, target_pace_max_s, target_hr_max, structure, strength_session_id, status)
select pl.user_id, pl.id, v.date, v.phase, v.week_index, v.type, v.title, v.distance_km, v.pmin, v.pmax, v.hrmax, v.structure,
  (select s.id from public.strength_sessions s where s.user_id = pl.user_id and s.day_of_week = v.dow limit 1),
  'planeado'
from (select distinct on (user_id) * from public.plans order by user_id, created_at) pl
cross join (values
${values}
) as v(date, phase, week_index, type, title, distance_km, pmin, pmax, hrmax, structure, dow);

-- planeado vs realizado: liga cada treino feito ao treino planeado do mesmo dia
update public.activities a set planned_workout_id = p.id
from public.planned_workouts p
where p.user_id = a.user_id and p.date = a.local_date
  and ((a.type = 'corrida' and p.type in ('fácil','qualidade','longo','prova','recuperação')) or (a.type = 'força' and p.type = 'força'));
update public.planned_workouts p set status = 'feito'
where exists (select 1 from public.activities a where a.planned_workout_id = p.id);

commit;
`;
writeFileSync("supabase/manual/plano-corrida.sql", sql);
console.log(rows.length, "treinos");
