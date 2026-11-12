-- Sincronização de hora a hora via pg_cron + pg_net do Supabase (gratuito).
-- O plano Hobby da Vercel só permite cron diário; isto garante o "no máximo 1 h".
-- Também mantém o projeto Supabase ativo (o plano gratuito pausa após 7 dias sem uso).
--
-- Como usar (Supabase → SQL Editor), UMA vez, depois do deploy:
--   1. Database → Extensions: ativar "pg_cron" e "pg_net".
--   2. Substituir <APP_URL> pelo URL da Vercel (ex.: https://treino.vercel.app).
--   3. Guardar o CRON_SECRET no Vault (não fica no histórico do cron):
--        select vault.create_secret('<O_MESMO_CRON_SECRET_DA_VERCEL>', 'cron_secret');
--   4. Correr o bloco abaixo.

select cron.schedule(
  'sync-intervals-hourly',
  '7 * * * *',
  $$
  select net.http_post(
    url := '<APP_URL>/api/cron/sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);

-- Ver execuções:   select * from cron.job_run_details order by start_time desc limit 20;
-- Remover:         select cron.unschedule('sync-intervals-hourly');
