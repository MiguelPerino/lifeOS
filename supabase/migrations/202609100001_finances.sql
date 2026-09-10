-- Personal spending and purchase goals. Money is always an integer number of cents.
create table public.finance_expenses (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  description text not null check(length(trim(description)) between 1 and 200),
  amount_cents bigint not null check(amount_cents between 1 and 100000000),
  category text not null check(category in ('Alimentação','Transporte','Casa','Saúde','Lazer','Compras','Educação','Outros')),
  spent_on date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.finance_expenses(user_id,spent_on desc,id);
create table public.finance_goals (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null check(length(trim(title)) between 1 and 100),
  target_cents bigint not null check(target_cents between 1 and 100000000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(id,user_id)
);
create index on public.finance_goals(user_id);
create table public.finance_contributions (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  goal_id uuid not null,
  amount_cents bigint not null check(amount_cents between -100000000 and 100000000 and amount_cents <> 0),
  saved_on date not null,
  created_at timestamptz not null default now(),
  foreign key(goal_id,user_id) references public.finance_goals(id,user_id) on delete cascade
);
create index on public.finance_contributions(user_id,goal_id);
create table public.finance_receipts (
  id uuid not null,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  payload_hash text not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key(id,user_id)
);
do $$ declare t text; begin
  foreach t in array array['finance_expenses','finance_goals','finance_contributions','finance_receipts'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('create policy owner on public.%I for all to authenticated using(user_id = (select auth.uid())) with check(user_id = (select auth.uid()))',t);
    execute format('grant select,insert,update,delete on public.%I to authenticated',t);
  end loop;
end $$;

-- Keep a goal's balance nonnegative even for direct authenticated writes.
create function public.guard_finance_contribution() returns trigger language plpgsql security invoker set search_path = '' as $$
declare balance bigint; begin
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text,10));
  if TG_OP = 'UPDATE' then raise exception 'finance_immutable_contribution'; end if;
  select coalesce(sum(amount_cents),0) into balance from public.finance_contributions where user_id=new.user_id and goal_id=new.goal_id;
  if balance + new.amount_cents < 0 then raise exception 'finance_insufficient_savings'; end if;
  return new;
end $$;
create trigger finance_balance before insert or update on public.finance_contributions for each row execute function public.guard_finance_contribution();
-- Corrections are signed contributions; history cannot be silently edited/deleted.
revoke update,delete on public.finance_contributions from authenticated;
revoke update,delete on public.finance_receipts from authenticated;

create function public.write_finance(action text, payload jsonb, request_key uuid) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare uid uuid := auth.uid(); rid uuid := (payload->>'id')::uuid; receipt public.finance_receipts; result jsonb; begin
  if uid is null then raise exception 'authentication_required'; end if;
  if request_key is null or rid is null then raise exception 'finance_invalid_request'; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text,10));
  select * into receipt from public.finance_receipts where user_id=uid and id=request_key;
  if found then
    if receipt.payload_hash <> md5(action || payload::text) then raise exception 'request_already_saved'; end if;
    return receipt.result;
  end if;
  if action='expense_save' then
    insert into public.finance_expenses(id,user_id,description,amount_cents,category,spent_on)
    values(rid,uid,payload->>'description',(payload->>'amount_cents')::bigint,payload->>'category',(payload->>'spent_on')::date)
    on conflict(id) do update set description=excluded.description,amount_cents=excluded.amount_cents,category=excluded.category,spent_on=excluded.spent_on,updated_at=now();
  elsif action='expense_delete' then
    delete from public.finance_expenses where id=rid and user_id=uid;
  elsif action='goal_save' then
    insert into public.finance_goals(id,user_id,title,target_cents) values(rid,uid,payload->>'title',(payload->>'target_cents')::bigint)
    on conflict(id) do update set title=excluded.title,target_cents=excluded.target_cents,updated_at=now();
  elsif action='goal_delete' then
    delete from public.finance_goals where id=rid and user_id=uid;
  elsif action='contribution_add' then
    insert into public.finance_contributions(id,user_id,goal_id,amount_cents,saved_on)
    values(rid,uid,(payload->>'goal_id')::uuid,(payload->>'amount_cents')::bigint,(payload->>'saved_on')::date);
  else raise exception 'finance_invalid_action'; end if;
  result := jsonb_build_object('id',rid);
  insert into public.finance_receipts(id,user_id,payload_hash,result) values(request_key,uid,md5(action || payload::text),result);
  return result;
end $$;

-- Aggregations cover the entire selected month, independently of the list page.
create function public.read_finances(month_start date, today date, category_filter text default 'all', page_number int default 0) returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare result jsonb; begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if month_start is null or today is null or extract(day from month_start) <> 1 or page_number is null or page_number < 0 or page_number > 100000 then raise exception 'finance_invalid_period'; end if;
  with expenses as (
    select * from public.finance_expenses where user_id=auth.uid() and spent_on>=month_start and spent_on < month_start + interval '1 month'
      and (category_filter='all' or category=category_filter)
  ), daily as (
    select spent_on, sum(amount_cents) as total from expenses group by spent_on
  ), grouped as (
    select category, sum(amount_cents) as total from expenses group by category
  ), listed as (
    select id,description,amount_cents,category,spent_on from expenses order by spent_on desc,created_at desc,id desc limit 20 offset page_number*20
  ), goals as (
    select g.id,g.title,g.target_cents,g.created_at,
      coalesce((select sum(c.amount_cents) from public.finance_contributions c where c.goal_id=g.id and c.user_id=auth.uid()),0) as saved_cents,
      coalesce((select jsonb_agg(c order by c.saved_on desc,c.created_at desc,c.id desc) from (select id,amount_cents,saved_on,created_at from public.finance_contributions where goal_id=g.id and user_id=auth.uid() order by saved_on desc,created_at desc,id desc limit 10) c),'[]'::jsonb) as contributions
    from public.finance_goals g where g.user_id=auth.uid()
  ) select jsonb_build_object(
    'today_cents',(select coalesce(sum(amount_cents),0) from public.finance_expenses where user_id=auth.uid() and spent_on=today),
    'month_cents',(select coalesce(sum(amount_cents),0) from expenses),
    'count',(select count(*) from expenses),
    'days',coalesce((select jsonb_agg(jsonb_build_object('day',spent_on,'total_cents',total) order by spent_on) from daily),'[]'::jsonb),
    'categories',coalesce((select jsonb_agg(jsonb_build_object('category',category,'total_cents',total) order by total desc,category) from grouped),'[]'::jsonb),
    'expenses',coalesce((select jsonb_agg(listed) from listed),'[]'::jsonb),
    'goals',coalesce((select jsonb_agg(goals order by created_at desc,id) from goals),'[]'::jsonb)
  ) into result;
  return result;
end $$;
revoke all on function public.guard_finance_contribution(),public.write_finance(text,jsonb,uuid),public.read_finances(date,date,text,int) from public,anon;
grant execute on function public.write_finance(text,jsonb,uuid),public.read_finances(date,date,text,int) to authenticated;
