-- Plano de força: zona do exercício e intervalo de carga do plano (load_kg passa a ser a carga usada).
alter table public.strength_exercises add column if not exists zone text;
alter table public.strength_exercises add column if not exists load_range text;
