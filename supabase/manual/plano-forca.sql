-- Substitui o plano de força pelo plano "Força para Corredores" do atleta.
-- Correr uma vez no SQL Editor do Supabase. Mantém as ligações aos treinos planeados (quarta/sexta).
begin;
alter table public.strength_exercises add column if not exists zone text;
alter table public.strength_exercises add column if not exists load_range text;

-- Pernas + Peito (~25 min)
insert into public.strength_sessions (user_id, name, day_of_week, notes)
select p.user_id, 'Pernas + Peito (~25 min)', 2, 'Halteres ajustáveis JUPPLIES 2–24 kg (15 níveis: sobe 1,5–2 kg de cada vez). Superset: 3 voltas por bloco, 60–75 s de descanso depois do par. Aquece 5 min (marcha rápida, mobilidade de anca). Mantém a carga 2–3 semanas até as reps ficarem fáceis e só depois sobes. Dor articular (≠ fadiga muscular): para o exercício.' from public.profile p
where not exists (select 1 from public.strength_sessions x where x.user_id = p.user_id and x.day_of_week = 2);
update public.strength_sessions set name = 'Pernas + Peito (~25 min)', notes = 'Halteres ajustáveis JUPPLIES 2–24 kg (15 níveis: sobe 1,5–2 kg de cada vez). Superset: 3 voltas por bloco, 60–75 s de descanso depois do par. Aquece 5 min (marcha rápida, mobilidade de anca). Mantém a carga 2–3 semanas até as reps ficarem fáceis e só depois sobes. Dor articular (≠ fadiga muscular): para o exercício.' where day_of_week = 2;
delete from public.strength_exercises where session_id in (select id from public.strength_sessions where day_of_week = 2);
insert into public.strength_exercises (user_id, session_id, position, superset, zone, name, sets, reps, load_range, load_kg, notes)
select ss.user_id, ss.id, v.position, v.superset, v.zone, v.name, v.sets, v.reps, v.load_range, null, v.notes
from public.strength_sessions ss
cross join (values
  (0, 'A1', 'Quadríceps/Glúteos', 'Agachamento búlgaro', 3, '8-10/perna', '6-10 kg', 'Pé de trás elevado num banco/cadeira; desce até a coxa da frente ficar paralela ao chão.'),
  (1, 'A2', 'Peito', 'Flexões (push-ups)', 3, '10-15', 'peso do corpo', 'Mãos ligeiramente mais largas que os ombros, corpo reto. Joelhos no chão se precisares de reduzir dificuldade.'),
  (2, 'B1', 'Cadeia posterior', 'Peso morto romeno unilateral', 3, '8/perna', '8-12 kg', 'Perna de apoio ligeiramente fletida, tronco reto. Sente o alongamento no isquiotibial.'),
  (3, 'B2', 'Peito', 'Supino no chão (floor press)', 3, '10-12', '8-12 kg', 'Deitado de costas, joelhos fletidos. Halteres sobem em linha reta acima do peito, cotovelos param no chão.'),
  (4, 'C1', 'Cadeia posterior', 'Ponte de glúteos com carga', 3, '12-15', '10-16 kg', 'Haltere apoiado sobre a bacia. Aperta os glúteos no topo 1-2 s.'),
  (5, 'C2', 'Core', 'Prancha frontal', 3, '30-45 s', 'peso do corpo', 'Cotovelos sob os ombros, corpo reto da cabeça aos calcanhares.')
) as v(position, superset, zone, name, sets, reps, load_range, notes)
where ss.day_of_week = 2;

-- Estabilidade + Braços (~25 min)
insert into public.strength_sessions (user_id, name, day_of_week, notes)
select p.user_id, 'Estabilidade + Braços (~25 min)', 4, 'Halteres ajustáveis JUPPLIES 2–24 kg (15 níveis: sobe 1,5–2 kg de cada vez). Superset: 3 voltas por bloco, 60–75 s de descanso depois do par. Aquece 5 min (marcha rápida, mobilidade de anca). Mantém a carga 2–3 semanas até as reps ficarem fáceis e só depois sobes. Dor articular (≠ fadiga muscular): para o exercício. Peito e braços são acessórios — volume baixo de propósito para não comprometer a recuperação das pernas.' from public.profile p
where not exists (select 1 from public.strength_sessions x where x.user_id = p.user_id and x.day_of_week = 4);
update public.strength_sessions set name = 'Estabilidade + Braços (~25 min)', notes = 'Halteres ajustáveis JUPPLIES 2–24 kg (15 níveis: sobe 1,5–2 kg de cada vez). Superset: 3 voltas por bloco, 60–75 s de descanso depois do par. Aquece 5 min (marcha rápida, mobilidade de anca). Mantém a carga 2–3 semanas até as reps ficarem fáceis e só depois sobes. Dor articular (≠ fadiga muscular): para o exercício. Peito e braços são acessórios — volume baixo de propósito para não comprometer a recuperação das pernas.' where day_of_week = 4;
delete from public.strength_exercises where session_id in (select id from public.strength_sessions where day_of_week = 4);
insert into public.strength_exercises (user_id, session_id, position, superset, zone, name, sets, reps, load_range, load_kg, notes)
select ss.user_id, ss.id, v.position, v.superset, v.zone, v.name, v.sets, v.reps, v.load_range, null, v.notes
from public.strength_sessions ss
cross join (values
  (0, 'A1', 'Quadríceps/Glúteos', 'Afundo lateral', 3, '8-10/perna', '6-10 kg', 'Passo largo para o lado, senta na anca do lado que se move, perna oposta fica esticada.'),
  (1, 'A2', 'Braços', 'Rosca bíceps', 3, '10-12', '6-10 kg', 'Cotovelos fixos junto ao corpo, sobe controlado sem balançar o tronco.'),
  (2, 'B1', 'Quadríceps/Glúteos', 'Step-down excêntrico', 3, '8/perna', '4-8 kg', 'Em cima de um step, desce devagar (3-4 s) sem deixar o joelho cair para dentro.'),
  (3, 'B2', 'Braços', 'Tríceps francês (overhead)', 3, '10-12', '6-10 kg', 'Um haltere com as duas mãos atrás da cabeça, cotovelos apontam para cima e ficam fixos, estende os braços.'),
  (4, 'C1', 'Core', 'Prancha lateral', 3, '25-35 s/lado', 'peso do corpo', 'Cotovelo sob o ombro, corpo em linha reta.'),
  (5, 'C2', 'Gémeos/Estabilidade', 'Elevação de gémeos unipodal', 3, '10-12/perna', '4-8 kg', 'Um haltere na mão do mesmo lado da perna de apoio. Sobe controlado, sem balançar.')
) as v(position, superset, zone, name, sets, reps, load_range, notes)
where ss.day_of_week = 4;

-- Opcional — Core & Mobilidade (~15 min, sem halteres)
insert into public.strength_sessions (user_id, name, day_of_week, notes)
select p.user_id, 'Opcional — Core & Mobilidade (~15 min, sem halteres)', 0, 'Segunda-feira em semanas com boa energia, ou substituto leve se faltares a quarta/sexta.' from public.profile p
where not exists (select 1 from public.strength_sessions x where x.user_id = p.user_id and x.day_of_week = 0);
update public.strength_sessions set name = 'Opcional — Core & Mobilidade (~15 min, sem halteres)', notes = 'Segunda-feira em semanas com boa energia, ou substituto leve se faltares a quarta/sexta.' where day_of_week = 0;
delete from public.strength_exercises where session_id in (select id from public.strength_sessions where day_of_week = 0);
insert into public.strength_exercises (user_id, session_id, position, superset, zone, name, sets, reps, load_range, load_kg, notes)
select ss.user_id, ss.id, v.position, v.superset, v.zone, v.name, v.sets, v.reps, v.load_range, null, v.notes
from public.strength_sessions ss
cross join (values
  (0, '1', 'Core', 'Prancha frontal', 3, '30-40 s', 'peso do corpo', 'Igual à de quarta — mantém como referência de progressão.'),
  (1, '2', 'Core', 'Bird-dog', 3, '8/lado', 'peso do corpo', 'De gatas, estende braço e perna opostos em simultâneo, bacia estável.'),
  (2, '3', 'Core', 'Dead bug', 3, '10/lado', 'peso do corpo', 'Deitado de costas, baixa braço e perna opostos até quase tocar no chão, lombar sempre no chão.'),
  (3, '4', 'Mobilidade', 'Mobilidade de anca (90/90)', 2, '8/lado', 'peso do corpo', 'Sentado, roda entre as duas posições de anca — melhora amplitude de passada.')
) as v(position, superset, zone, name, sets, reps, load_range, notes)
where ss.day_of_week = 0;

update public.planned_workouts set title = 'Força — Pernas + Peito' where type = 'força' and extract(isodow from date) = 3;
update public.planned_workouts set title = 'Força — Estabilidade + Braços' where type = 'força' and extract(isodow from date) = 5;
update public.planned_workouts set structure = '[{"kind":"força","description":"Ver plano de força."}]'::jsonb where type = 'força';
commit;
