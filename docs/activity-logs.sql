create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  entity_type text not null check (entity_type in ('project', 'task')),
  entity_id uuid not null,
  project_id uuid references public.projects(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_member_id uuid references public.workspace_members(id) on delete set null,
  action text not null,
  title text not null,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists activity_logs_workspace_entity_idx
on public.activity_logs (workspace_id, entity_type, entity_id, created_at desc);

create index if not exists activity_logs_workspace_project_idx
on public.activity_logs (workspace_id, project_id, created_at desc);

create index if not exists activity_logs_workspace_task_idx
on public.activity_logs (workspace_id, task_id, created_at desc);

alter table public.activity_logs enable row level security;

drop policy if exists "activity_logs_select_workspace_members"
on public.activity_logs;

create policy "activity_logs_select_workspace_members"
on public.activity_logs
for select
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = activity_logs.workspace_id
      and wm.user_id = auth.uid()
      and wm.status = 'active'
  )
);

drop policy if exists "activity_logs_insert_workspace_members"
on public.activity_logs;

create policy "activity_logs_insert_workspace_members"
on public.activity_logs
for insert
with check (
  actor_user_id = auth.uid()
  and exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = activity_logs.workspace_id
      and wm.user_id = auth.uid()
      and wm.status = 'active'
  )
);
