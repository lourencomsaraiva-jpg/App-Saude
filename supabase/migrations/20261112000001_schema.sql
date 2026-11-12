-- Esquema inicial — App Treino & Nutrição
-- Todas as tabelas: id uuid, user_id, created_at, updated_at e RLS (auth.uid() = user_id).

create extension if not exists pgcrypto;

create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------- perfil
create table public.profile (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique default auth.uid() references auth.users on delete cascade,
  name text not null default '',
  age int,
  height_cm numeric(5,1),
  start_weight_kg numeric(5,1),
  start_date date,
  goal_weight_kg numeric(5,1),
  goal_10k_s int,
  goal_hm_s int,
  pb_10k_pace_s int,
  pb_hm_s int,
  easy_pace_min_s int,
  easy_pace_max_s int,
  easy_hr_max int,
  threshold_hr_min int,
  threshold_hr_max int,
  max_hr int,
  base_burn_kcal numeric(7,1) not null default 2417,
  protein_target_g numeric(6,1) not null default 155,
  fiber_target_g numeric(6,1) not null default 30,
  rest_base_kcal numeric(7,1) not null default 2050,
  rest_carbs_g numeric(6,1) not null default 250,
  rest_fat_g numeric(6,1) not null default 48,
  ratio_ref_kcal numeric(7,1) not null default 2747,
  ratio_carbs_g numeric(6,1) not null default 385,
  ratio_fat_g numeric(6,1) not null default 65,
  exercise_factor numeric(4,3) not null default 0.95,
  exercise_factor_start date not null default '2026-10-12',
  weekly_template jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.calorie_phases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  start_date date,
  end_date date,
  base_kcal numeric(7,1) not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- dias e sono
create table public.days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  date date not null,
  weight_kg numeric(5,1),
  weight_source text check (weight_source in ('intervals','fit','manual','seed')),
  steps int,
  steps_source text check (steps_source in ('intervals','fit','manual','seed')),
  resting_hr int,
  hrv numeric(6,1),
  notes text,
  -- kcal brutas de exercício introduzidas à mão / do histórico (prevalecem sobre a soma das atividades)
  exercise_kcal_raw_override numeric(7,1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);

create table public.sleep (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  day_date date not null, -- convenção: noite que acaba na manhã de X → X−1
  total_min int,
  deep_min int,
  light_min int,
  rem_min int,
  awake_min int,
  score numeric(5,1),
  source text not null default 'manual' check (source in ('intervals','fit','manual','seed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, day_date)
);

-- ---------------------------------------------------------------- comida
create table public.foods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  serving text not null default '1 dose',
  serving_g numeric(7,1),
  kcal numeric(7,1) not null default 0,
  protein_g numeric(6,1) not null default 0,
  carbs_g numeric(6,1) not null default 0,
  fat_g numeric(6,1) not null default 0,
  fiber_g numeric(6,1) not null default 0,
  is_favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

-- kind: 'recipe' (receita com porções) ou 'favorite_meal' (refeição favorita de um toque)
create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  kind text not null default 'recipe' check (kind in ('recipe','favorite_meal')),
  portions numeric(6,1) not null default 1,
  default_label text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

create table public.recipe_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  recipe_id uuid not null references public.recipes on delete cascade,
  food_id uuid references public.foods on delete set null,
  position int not null default 0,
  description text not null,
  quantity numeric(8,2),
  unit text,
  kcal numeric(7,1) not null default 0,
  protein_g numeric(6,1),
  carbs_g numeric(6,1),
  fat_g numeric(6,1),
  fiber_g numeric(6,1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  date date not null,
  label text not null default 'extra' check (label in ('pequeno-almoço','almoço','lanche','jantar','extra','histórico')),
  eaten_at time,
  photo_path text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index meals_user_date on public.meals (user_id, date);

create table public.meal_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  meal_id uuid not null references public.meals on delete cascade,
  food_id uuid references public.foods on delete set null,
  position int not null default 0,
  description text not null,
  quantity numeric(8,2),
  unit text,
  kcal numeric(7,1) not null default 0,
  protein_g numeric(6,1),
  carbs_g numeric(6,1),
  fat_g numeric(6,1),
  fiber_g numeric(6,1),
  weight_confirmed boolean not null default false,
  source text not null default 'manual' check (source in ('manual','ai_photo','ai_text','favorite','recipe','copy','seed')),
  needs_review boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index meal_items_meal on public.meal_items (meal_id);

-- ---------------------------------------------------------------- treino
create table public.races (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  date date not null,
  distance_m int not null,
  goal_time_s int,
  result_time_s int,
  is_main boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  race_id uuid references public.races on delete set null,
  start_date date not null,
  end_date date not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.strength_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  day_of_week int check (day_of_week between 0 and 6), -- 0 = segunda
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.strength_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  session_id uuid not null references public.strength_sessions on delete cascade,
  position int not null default 0,
  name text not null,
  sets int,
  reps text,
  load_kg numeric(5,1),
  superset text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.planned_workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  plan_id uuid references public.plans on delete cascade,
  date date not null,
  phase text, -- base, específica, afinamento, prova, recuperação
  week_index int,
  type text not null, -- descanso, qualidade, força, fácil, longo, prova, recuperação
  title text not null,
  distance_km numeric(5,1),
  target_pace_min_s int,
  target_pace_max_s int,
  target_hr_min int,
  target_hr_max int,
  structure jsonb not null default '[]'::jsonb,
  strength_session_id uuid references public.strength_sessions on delete set null,
  status text not null default 'planeado' check (status in ('planeado','feito','falhado','alterado')),
  change_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index planned_workouts_user_date on public.planned_workouts (user_id, date);

create table public.planned_workout_changes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  workout_id uuid references public.planned_workouts on delete cascade,
  reason text not null,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  external_id text not null,
  source text not null check (source in ('intervals','fit','manual','seed','strava')),
  name text,
  type text not null default 'outro', -- corrida, força, bicicleta, caminhada, natação, outro
  start_time timestamptz,
  local_date date not null,
  distance_m numeric(9,1),
  duration_s numeric(8,1),
  moving_time_s numeric(8,1),
  avg_hr int,
  max_hr int,
  kcal_raw numeric(7,1),
  ascent_m numeric(6,1),
  descent_m numeric(6,1),
  training_effect numeric(3,1),
  training_load numeric(6,1),
  conditions text,
  feel text,
  fit_path text,
  planned_workout_id uuid references public.planned_workouts on delete set null,
  ai_analysis text,
  raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, source, external_id)
);
create index activities_user_date on public.activities (user_id, local_date);

create table public.activity_laps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  activity_id uuid not null references public.activities on delete cascade,
  kind text not null check (kind in ('lap','km_split')),
  idx int not null,
  label text,
  distance_m numeric(9,1),
  duration_s numeric(8,1),
  avg_hr int,
  max_hr int,
  ascent_m numeric(6,1),
  descent_m numeric(6,1),
  bearing_deg int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (activity_id, kind, idx)
);

-- ---------------------------------------------------------------- IA e sincronização
create table public.coach_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  role text not null check (role in ('user','assistant')),
  kind text not null default 'chat' check (kind in ('chat','analysis','review','projection')),
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index coach_messages_user_created on public.coach_messages (user_id, created_at);

create table public.weekly_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  week_start date not null,
  review_md text not null,
  proposal jsonb not null default '[]'::jsonb,
  status text not null default 'pendente' check (status in ('pendente','aceite','rejeitada')),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, week_start)
);

create table public.sync_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  source text not null,
  trigger text not null default 'manual', -- cron, manual, open, upload
  status text not null default 'running' check (status in ('running','ok','error','partial')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  imported_count int not null default 0,
  error text,
  details jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index sync_log_user_started on public.sync_log (user_id, started_at desc);

-- ---------------------------------------------------------------- updated_at + RLS
do $$
declare t text;
begin
  foreach t in array array[
    'profile','calorie_phases','days','sleep','foods','recipes','recipe_items','meals','meal_items',
    'races','plans','strength_sessions','strength_exercises','planned_workouts','planned_workout_changes',
    'activities','activity_laps','coach_messages','weekly_reviews','sync_log'
  ] loop
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "own rows" on public.%I for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
  end loop;
end $$;

-- ---------------------------------------------------------------- vista de totais diários
-- Somas por dia (a partir dos valores guardados). Os números derivados — exercício ajustado,
-- alvo, macros-alvo, "Falta" e saldo — são calculados por lib/calc/day.ts (fonte única das regras),
-- para que interface, exportações e IA usem exatamente as mesmas fórmulas testadas.
create view public.v_day_summary with (security_invoker = true) as
with dates as (
  select user_id, date from public.days
  union select user_id, date from public.meals
  union select user_id, local_date from public.activities
),
food as (
  select m.user_id, m.date,
    round(sum(i.kcal), 1) as kcal,
    round(sum(i.protein_g), 1) as protein_g,
    round(sum(i.carbs_g), 1) as carbs_g,
    round(sum(i.fat_g), 1) as fat_g,
    round(sum(i.fiber_g), 1) as fiber_g
  from public.meals m join public.meal_items i on i.meal_id = m.id
  group by m.user_id, m.date
),
act as (
  select user_id, local_date as date,
    round(sum(kcal_raw), 1) as activity_kcal_raw,
    round(sum(distance_m) filter (where type = 'corrida'), 1) as run_distance_m,
    count(*) as activity_count
  from public.activities group by user_id, local_date
)
select d.user_id, d.date,
  coalesce(f.kcal, 0) as kcal, f.protein_g, f.carbs_g, f.fat_g, f.fiber_g,
  coalesce(dy.exercise_kcal_raw_override, a.activity_kcal_raw, 0) as exercise_kcal_raw,
  a.run_distance_m, coalesce(a.activity_count, 0) as activity_count,
  dy.weight_kg, dy.steps, dy.resting_hr, dy.hrv,
  s.total_min as sleep_total_min
from dates d
left join food f on f.user_id = d.user_id and f.date = d.date
left join act a on a.user_id = d.user_id and a.date = d.date
left join public.days dy on dy.user_id = d.user_id and dy.date = d.date
left join public.sleep s on s.user_id = d.user_id and s.day_date = d.date;

-- ---------------------------------------------------------------- Storage (fotos e ficheiros FIT)
insert into storage.buckets (id, name, public) values ('uploads', 'uploads', false)
on conflict (id) do update set public = false;

create policy "uploads: ler os próprios" on storage.objects for select to authenticated
  using (bucket_id = 'uploads' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "uploads: criar os próprios" on storage.objects for insert to authenticated
  with check (bucket_id = 'uploads' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "uploads: alterar os próprios" on storage.objects for update to authenticated
  using (bucket_id = 'uploads' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "uploads: apagar os próprios" on storage.objects for delete to authenticated
  using (bucket_id = 'uploads' and (storage.foldername(name))[1] = auth.uid()::text);
