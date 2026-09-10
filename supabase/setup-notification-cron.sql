-- Run once in the hosted Supabase SQL Editor AFTER creating the two Vault secrets:
-- lifeos_url = https://YOUR-PRODUCTION-DEPLOY.vercel.app (no trailing slash)
-- lifeos_cron_secret = same CRON_SECRET configured in Vercel
-- Store secrets in the dashboard Vault UI, never in this file.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

do $$
begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'lifeos_url')
    or not exists (select 1 from vault.decrypted_secrets where name = 'lifeos_cron_secret') then
    raise exception 'Create lifeos_url and lifeos_cron_secret in Vault first';
  end if;
end $$;

select cron.schedule(
  'lifeos-notifications',
  '*/5 * * * *',
  $job$
    select net.http_post(
      url := rtrim((select decrypted_secret from vault.decrypted_secrets where name = 'lifeos_url'), '/') || '/api/cron/notifications',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'lifeos_cron_secret')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 60000
    );
  $job$
);
