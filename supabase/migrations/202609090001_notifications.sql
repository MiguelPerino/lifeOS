create table public.notification_preferences (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  timezone text not null default 'America/Sao_Paulo',
  daily_enabled boolean not null default true,
  daily_time text not null default '08:00' check (daily_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  pending_enabled boolean not null default true,
  pending_time text not null default '17:00' check (pending_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  deadline_enabled boolean not null default true,
  deadline_time text not null default '19:00' check (deadline_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  overdue_enabled boolean not null default false,
  overdue_time text not null default '09:00' check (overdue_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  quiet_start text not null default '22:00' check (quiet_start ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  quiet_end text not null default '07:00' check (quiet_end ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
);
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  endpoint text not null unique check (length(endpoint) <= 2048),
  keys jsonb not null,
  created_at timestamptz not null default now()
);
create index on public.push_subscriptions(user_id);
create table public.notification_deliveries (
  subscription_id uuid not null references public.push_subscriptions on delete cascade,
  message_key text not null,
  claimed_at timestamptz not null default now(),
  sent_at timestamptz,
  primary key(subscription_id, message_key)
);
do $$ declare t text; begin
  foreach t in array array['notification_preferences','push_subscriptions'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy owner on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
    execute format('grant select,insert,update,delete on public.%I to authenticated', t);
  end loop;
end $$;
alter table public.notification_deliveries enable row level security;
-- Clients cannot create delivery receipts or access another device's deliveries.
revoke all on public.notification_deliveries from anon, authenticated;
grant all on public.notification_preferences, public.push_subscriptions, public.notification_deliveries to service_role;

-- Atomic lease prevents concurrent cron runs from sending the same digest.
create function public.claim_notification(p_subscription uuid, p_key text)
returns boolean language sql security invoker set search_path = '' as $$
  with claimed as (
    insert into public.notification_deliveries(subscription_id, message_key)
    values(p_subscription, p_key)
    on conflict(subscription_id, message_key) do update set claimed_at = now()
    where public.notification_deliveries.sent_at is null
      and public.notification_deliveries.claimed_at < now() - interval '5 minutes'
    returning 1
  ) select exists(select 1 from claimed);
$$;
revoke all on function public.claim_notification(uuid,text) from public, anon, authenticated;
grant execute on function public.claim_notification(uuid,text) to service_role;
