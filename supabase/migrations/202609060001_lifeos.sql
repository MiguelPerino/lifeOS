create schema if not exists extensions;
create extension if not exists vector with schema extensions;
create extension if not exists pg_trgm with schema extensions;
grant usage on schema extensions to authenticated;

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text not null default '',
  timezone text not null default 'America/Sao_Paulo',
  created_at timestamptz not null default now()
);
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  title text not null check (length(title) between 1 and 200),
  description text not null default '',
  status text not null default 'planning' check (status in ('planning','active','paused','completed','archived')),
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(id,user_id)
);
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  title text not null check (length(title) between 1 and 200),
  description text not null default '',
  status text not null default 'todo' check (status in ('todo','in_progress','done','cancelled')),
  priority text not null default 'medium' check (priority in ('low','medium','high','urgent')),
  due_date date,
  project_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  unique(id,user_id),
  foreign key(project_id,user_id) references public.projects(id,user_id) on delete set null (project_id)
);
create table public.task_dependencies (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  task_id uuid not null,
  depends_on_id uuid not null,
  primary key(task_id,depends_on_id),
  check(task_id <> depends_on_id),
  foreign key(task_id,user_id) references public.tasks(id,user_id) on delete cascade,
  foreign key(depends_on_id,user_id) references public.tasks(id,user_id) on delete cascade
);
create table public.subtasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  task_id uuid not null,
  title text not null check(length(title) between 1 and 200),
  done boolean not null default false,
  position integer not null default 0,
  foreign key(task_id,user_id) references public.tasks(id,user_id) on delete cascade
);
create table public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null check(length(name) between 1 and 40),
  unique(user_id,name), unique(id,user_id)
);
create table public.task_tags (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  task_id uuid not null, tag_id uuid not null,
  primary key(task_id,tag_id),
  foreign key(task_id,user_id) references public.tasks(id,user_id) on delete cascade,
  foreign key(tag_id,user_id) references public.tags(id,user_id) on delete cascade
);
create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null check(length(title) between 1 and 200),
  content text not null default '',
  kind text not null default 'note' check(kind in ('note','idea','event','reminder')),
  due_date date,
  project_id uuid,
  embedding extensions.vector(768),
  embedding_status text not null default 'pending' check(embedding_status in ('pending','ready','failed')),
  embedding_model text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(id,user_id),
  foreign key(project_id,user_id) references public.projects(id,user_id) on delete set null (project_id)
);
create table public.note_tags (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  note_id uuid not null, tag_id uuid not null,
  primary key(note_id,tag_id),
  foreign key(note_id,user_id) references public.notes(id,user_id) on delete cascade,
  foreign key(tag_id,user_id) references public.tags(id,user_id) on delete cascade
);
create table public.activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  project_id uuid,
  action text not null,
  title text not null,
  created_at timestamptz not null default now(),
  foreign key(project_id,user_id) references public.projects(id,user_id) on delete set null (project_id)
);
create table public.daily_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  plan_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,plan_date), unique(id,user_id)
);
create table public.daily_plan_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  plan_id uuid not null, task_id uuid not null,
  start_time time not null,
  duration_minutes integer not null check(duration_minutes between 5 and 480),
  position integer not null check(position >= 0),
  unique(plan_id,task_id),
  foreign key(plan_id,user_id) references public.daily_plans(id,user_id) on delete cascade,
  foreign key(task_id,user_id) references public.tasks(id,user_id) on delete cascade
);
create table public.inbox_receipts (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  payload_hash text not null,
  result jsonb not null,
  created_at timestamptz not null default now()
);

-- RLS also protects junction tables; composite foreign keys prevent cross-account links.
do $$ declare t text; begin
  foreach t in array array['projects','tasks','task_dependencies','subtasks','tags','task_tags','notes','note_tags','activities','daily_plans','daily_plan_items','inbox_receipts'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('create policy owner_select on public.%I for select to authenticated using (user_id = (select auth.uid()))',t);
    execute format('create policy owner_insert on public.%I for insert to authenticated with check (user_id = (select auth.uid()))',t);
    execute format('create policy owner_update on public.%I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',t);
    execute format('create policy owner_delete on public.%I for delete to authenticated using (user_id = (select auth.uid()))',t);
    execute format('create index on public.%I(user_id)',t);
  end loop;
end $$;
alter table public.profiles enable row level security;
create policy owner_profile on public.profiles for all to authenticated using (id = (select auth.uid())) with check(id = (select auth.uid()));
create index tasks_due on public.tasks(user_id,due_date) where status not in ('done','cancelled');
create index tasks_project on public.tasks(project_id);
create index notes_project on public.notes(project_id);
create index activities_recent on public.activities(user_id,created_at desc);
create index notes_embedding on public.notes using hnsw (embedding extensions.vector_cosine_ops);
create index notes_text on public.notes using gin ((title || ' ' || content) extensions.gin_trgm_ops);
create index tasks_title on public.tasks using gin (title extensions.gin_trgm_ops);
create index dependencies_reverse on public.task_dependencies(depends_on_id);

create function public.new_profile() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id,display_name) values(new.id,coalesce(new.raw_user_meta_data->>'display_name',''));
  return new;
end $$;
create trigger auth_profile after insert on auth.users for each row execute function public.new_profile();
-- Support installing LifeOS into a project that already has Auth users.
insert into public.profiles(id,display_name)
select id,coalesce(raw_user_meta_data->>'display_name','') from auth.users
on conflict(id) do nothing;

create function public.record_change() returns trigger language plpgsql security invoker set search_path = '' as $$
declare p uuid; a text; begin
  if TG_OP = 'UPDATE' then
    new.updated_at := now();
    if TG_TABLE_NAME = 'tasks' then
      new.completed_at := case when new.status='done' then coalesce(old.completed_at,now()) else null end;
    end if;
    if TG_TABLE_NAME = 'notes' then
      if new.title is not distinct from old.title and new.content is not distinct from old.content and new.project_id is not distinct from old.project_id and new.kind is not distinct from old.kind and new.due_date is not distinct from old.due_date then
        new.updated_at := old.updated_at;
        return new;
      end if;
      if new.title is distinct from old.title or new.content is distinct from old.content then
        new.embedding := null; new.embedding_status := 'pending'; new.embedding_model := null;
      end if;
    end if;
  elsif TG_TABLE_NAME = 'tasks' then
    if new.status='done' then new.completed_at := now(); end if;
  end if;
  if TG_OP = 'INSERT' then a := 'created';
  elsif TG_TABLE_NAME in ('tasks','projects') then
    if new.status is distinct from old.status then a := new.status; else return new; end if;
  else a := 'updated'; end if;
  if TG_TABLE_NAME = 'projects' then p := null; else p := new.project_id; end if;
  insert into public.activities(user_id,entity_type,entity_id,project_id,action,title) values(new.user_id,TG_TABLE_NAME,new.id,p,a,new.title);
  return new;
end $$;
create trigger track_tasks before insert or update on public.tasks for each row execute function public.record_change();
create trigger track_projects before insert or update on public.projects for each row execute function public.record_change();
create trigger track_notes before insert or update on public.notes for each row execute function public.record_change();

create function public.guard_dependency() returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text,0));
  if exists (
    with recursive chain(id) as (
      select new.depends_on_id
      union
      select d.depends_on_id from public.task_dependencies d join chain c on d.task_id=c.id where d.user_id=new.user_id
    ) select 1 from chain where id=new.task_id
  ) then raise exception 'dependency_cycle'; end if;
  return new;
end $$;
create trigger no_cycles before insert or update on public.task_dependencies for each row execute function public.guard_dependency();

-- All mutations use invoker rights: authenticated user's RLS remains active.
create function public.save_record(entity text, payload jsonb) returns uuid language plpgsql security invoker set search_path = '' as $$
declare rid uuid := coalesce((payload->>'id')::uuid,gen_random_uuid()); uid uuid := auth.uid(); label text; tid uuid; item jsonb; pos int:=0;
begin
  if uid is null then raise exception 'authentication_required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
  if entity='projects' then
    insert into public.projects(id,user_id,title,description,status,due_date)
    values(rid,uid,payload->>'title',coalesce(payload->>'description',''),coalesce(payload->>'status','planning'),(payload->>'due_date')::date)
    on conflict(id) do update set title=excluded.title,description=excluded.description,status=excluded.status,due_date=excluded.due_date;
  elsif entity='tasks' then
    insert into public.tasks(id,user_id,title,description,status,priority,due_date,project_id)
    values(rid,uid,payload->>'title',coalesce(payload->>'description',''),coalesce(payload->>'status','todo'),coalesce(payload->>'priority','medium'),(payload->>'due_date')::date,(payload->>'project_id')::uuid)
    on conflict(id) do update set title=excluded.title,description=excluded.description,status=excluded.status,priority=excluded.priority,due_date=excluded.due_date,project_id=excluded.project_id;
    delete from public.subtasks where task_id=rid and user_id=uid;
    for item in select value from jsonb_array_elements(coalesce(payload->'subtasks','[]')) loop
      insert into public.subtasks(user_id,task_id,title,done,position) values(uid,rid,item->>'title',coalesce((item->>'done')::boolean,false),pos); pos:=pos+1;
    end loop;
    delete from public.task_dependencies where task_id=rid and user_id=uid;
    for label in select jsonb_array_elements_text(coalesce(payload->'dependencies','[]')) loop
      insert into public.task_dependencies(user_id,task_id,depends_on_id) values(uid,rid,label::uuid);
    end loop;
    if payload->>'status'='done' and exists(select 1 from public.task_dependencies d join public.tasks t on t.id=d.depends_on_id where d.task_id=rid and d.user_id=uid and t.status<>'done') then raise exception 'task_blocked'; end if;
    delete from public.task_tags where task_id=rid and user_id=uid;
  elsif entity='notes' then
    insert into public.notes(id,user_id,title,content,kind,due_date,project_id)
    values(rid,uid,payload->>'title',coalesce(payload->>'content',''),coalesce(payload->>'kind','note'),(payload->>'due_date')::date,(payload->>'project_id')::uuid)
    on conflict(id) do update set title=excluded.title,content=excluded.content,kind=excluded.kind,due_date=excluded.due_date,project_id=excluded.project_id;
    delete from public.note_tags where note_id=rid and user_id=uid;
  else raise exception 'invalid_entity'; end if;
  if entity in ('tasks','notes') then
    for label in select distinct lower(trim(value)) from jsonb_array_elements_text(coalesce(payload->'tags','[]')) loop
      insert into public.tags(user_id,name) values(uid,label) on conflict(user_id,name) do update set name=excluded.name returning id into tid;
      if entity='tasks' then insert into public.task_tags(user_id,task_id,tag_id) values(uid,rid,tid);
      else insert into public.note_tags(user_id,note_id,tag_id) values(uid,rid,tid); end if;
    end loop;
  end if;
  return rid;
end $$;

create function public.commit_inbox(items jsonb, request_key uuid default gen_random_uuid()) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare item jsonb; rid uuid; pid uuid; pname text; payload jsonb; ids uuid[]:='{}'; idx int; dep jsonb; result jsonb:='[]'; receipt public.inbox_receipts;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if jsonb_array_length(items)>20 then raise exception 'too_many_items'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
  select * into receipt from public.inbox_receipts where id=request_key and user_id=auth.uid();
  if found then
    if receipt.payload_hash<>md5(items::text) then raise exception 'request_already_saved'; end if;
    return receipt.result;
  end if;
  -- Resolve explicit projects first, even when a dependent task appears earlier in the batch.
  for item in select value from jsonb_array_elements(items) where value->>'type'='project' loop
    select id into pid from public.projects where user_id=auth.uid() and lower(title)=lower(item->>'title') order by created_at limit 1;
    if pid is null then perform public.save_record('projects',item || '{"status":"planning"}'); end if;
  end loop;
  for item in select value from jsonb_array_elements(items) loop
    pid:=null; pname:=nullif(trim(item->>'project'),'');
    if pname is not null then
      select id into pid from public.projects where user_id=auth.uid() and lower(title)=lower(pname) order by created_at limit 1;
      if pid is null then pid:=public.save_record('projects',jsonb_build_object('title',pname,'status','planning')); end if;
    end if;
    payload := item || jsonb_build_object('project_id',pid,'dependencies','[]'::jsonb);
    if item->>'type'='project' then
      select id into rid from public.projects where user_id=auth.uid() and lower(title)=lower(item->>'title') order by created_at limit 1;
    elsif item->>'type'='task' then
      rid:=public.save_record('tasks',payload || '{"status":"todo"}');
    else
      rid:=public.save_record('notes',payload || jsonb_build_object('kind',item->>'type','content',item->>'description'));
    end if;
    ids:=array_append(ids,rid);
    result:=result || jsonb_build_array(jsonb_build_object('id',rid,'type',item->>'type'));
  end loop;
  idx:=0;
  for item in select value from jsonb_array_elements(items) loop
    idx:=idx+1;
    for dep in select value from jsonb_array_elements(item->'depends_on') loop
      if item->>'type'<>'task' or items->(dep::int)->>'type'<>'task' or (dep::int)+1=idx or (dep::int)<0 or (dep::int)>=array_length(ids,1) then raise exception 'invalid_dependency'; end if;
      insert into public.task_dependencies(user_id,task_id,depends_on_id) values(auth.uid(),ids[idx],ids[(dep::int)+1]);
    end loop;
  end loop;
  insert into public.inbox_receipts(id,user_id,payload_hash,result) values(request_key,auth.uid(),md5(items::text),result);
  return result;
end $$;

create function public.save_daily_plan(day date, items jsonb) returns uuid language plpgsql security invoker set search_path = '' as $$
declare pid uuid; item jsonb; pos int:=0; seen uuid[]:='{}'; previous_end int:=0; start_minute int; duration int;
begin
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
  if jsonb_array_length(items)>30 then raise exception 'too_many_items'; end if;
  insert into public.daily_plans(user_id,plan_date) values(auth.uid(),day) on conflict(user_id,plan_date) do update set updated_at=now() returning id into pid;
  delete from public.daily_plan_items where plan_id=pid and user_id=auth.uid();
  for item in select value from jsonb_array_elements(items) loop
    if not exists(select 1 from public.tasks where id=(item->>'task_id')::uuid and user_id=auth.uid() and status not in ('done','cancelled')) then raise exception 'invalid_plan_task'; end if;
    if exists(select 1 from public.task_dependencies d join public.tasks t on t.id=d.depends_on_id where d.task_id=(item->>'task_id')::uuid and d.user_id=auth.uid() and t.status<>'done' and not(t.id=any(seen))) then raise exception 'invalid_plan_dependency'; end if;
    start_minute:=extract(hour from (item->>'start_time')::time)::int*60+extract(minute from (item->>'start_time')::time)::int;
    duration:=(item->>'duration_minutes')::int;
    if start_minute<previous_end or start_minute+duration>1440 then raise exception 'invalid_plan_time'; end if;
    previous_end:=start_minute+duration;seen:=array_append(seen,(item->>'task_id')::uuid);
    insert into public.daily_plan_items(user_id,plan_id,task_id,start_time,duration_minutes,position) values(auth.uid(),pid,(item->>'task_id')::uuid,(item->>'start_time')::time,(item->>'duration_minutes')::int,pos);
    pos:=pos+1;
  end loop;
  insert into public.activities(user_id,entity_type,entity_id,action,title) values(auth.uid(),'daily_plans',pid,'planned','Planejamento de '||day::text);
  return pid;
end $$;

create function public.match_notes(query_embedding extensions.vector(768), match_count int default 8)
returns table(id uuid,title text,content text,similarity float)
language sql stable security invoker set search_path = '' as $$
  select n.id,n.title,left(n.content,4000),1-(n.embedding OPERATOR(extensions.<=>) query_embedding)
  from public.notes n where n.user_id=auth.uid() and n.embedding_status='ready'
  order by n.embedding OPERATOR(extensions.<=>) query_embedding limit least(greatest(match_count,1),20);
$$;

-- No anonymously callable data functions.
revoke execute on all functions in schema public from public, anon;
grant execute on function public.save_record(text,jsonb),public.commit_inbox(jsonb,uuid),public.save_daily_plan(date,jsonb),public.match_notes(extensions.vector,integer) to authenticated;
grant select,insert,update,delete on all tables in schema public to authenticated;
