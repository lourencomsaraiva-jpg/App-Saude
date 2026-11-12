/** Gera supabase/manual/plano-forca.sql a partir de lib/defaults.ts (fonte única do plano de força). */
import { writeFileSync } from "node:fs";
import { DEFAULT_STRENGTH } from "../lib/defaults";

const q = (s: string | number | null) => (s === null ? "null" : typeof s === "number" ? String(s) : `'${s.replace(/'/g, "''")}'`);
const lines: string[] = [
  "-- Substitui o plano de força pelo plano \"Força para Corredores\" do atleta.",
  "-- Correr uma vez no SQL Editor do Supabase. Mantém as ligações aos treinos planeados (quarta/sexta).",
  "begin;",
  "alter table public.strength_exercises add column if not exists zone text;",
  "alter table public.strength_exercises add column if not exists load_range text;",
  "",
];
for (const s of DEFAULT_STRENGTH) {
  lines.push(`-- ${s.name}`);
  lines.push(
    `insert into public.strength_sessions (user_id, name, day_of_week, notes)
select p.user_id, ${q(s.name)}, ${s.day_of_week}, ${q(s.notes)} from public.profile p
where not exists (select 1 from public.strength_sessions x where x.user_id = p.user_id and x.day_of_week = ${s.day_of_week});`,
  );
  lines.push(`update public.strength_sessions set name = ${q(s.name)}, notes = ${q(s.notes)} where day_of_week = ${s.day_of_week};`);
  lines.push(`delete from public.strength_exercises where session_id in (select id from public.strength_sessions where day_of_week = ${s.day_of_week});`);
  lines.push(
    `insert into public.strength_exercises (user_id, session_id, position, superset, zone, name, sets, reps, load_range, load_kg, notes)
select ss.user_id, ss.id, v.position, v.superset, v.zone, v.name, v.sets, v.reps, v.load_range, null, v.notes
from public.strength_sessions ss
cross join (values
${s.exercises.map((e, i) => `  (${i}, ${q(e.superset)}, ${q(e.zone)}, ${q(e.name)}, ${e.sets}, ${q(e.reps)}, ${q(e.load_range)}, ${q(e.notes)})`).join(",\n")}
) as v(position, superset, zone, name, sets, reps, load_range, notes)
where ss.day_of_week = ${s.day_of_week};`,
  );
  lines.push("");
}
lines.push(`update public.planned_workouts set title = 'Força — Pernas + Peito' where type = 'força' and extract(isodow from date) = 3;`);
lines.push(`update public.planned_workouts set title = 'Força — Estabilidade + Braços' where type = 'força' and extract(isodow from date) = 5;`);
lines.push(`update public.planned_workouts set structure = '[{"kind":"força","description":"Ver plano de força."}]'::jsonb where type = 'força';`);
lines.push("commit;");
writeFileSync("supabase/manual/plano-forca.sql", lines.join("\n") + "\n");
console.log("ok");
