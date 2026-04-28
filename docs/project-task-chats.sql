alter table public.task_comments
add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;

alter table public.task_comments
add column if not exists author_user_id uuid references auth.users(id) on delete set null;

alter table public.task_comments
add column if not exists author_member_id uuid references public.workspace_members(id) on delete set null;

update public.task_comments tc
set workspace_id = t.workspace_id
from public.tasks t
where tc.task_id = t.id
  and tc.workspace_id is null;

alter table public.task_comments
alter column workspace_id set not null;

create index if not exists task_comments_workspace_task_idx
on public.task_comments (workspace_id, task_id, created_at);

alter table public.task_comments enable row level security;

drop policy if exists "task_comments_select_workspace_members"
on public.task_comments;

create policy "task_comments_select_workspace_members"
on public.task_comments
for select
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = task_comments.workspace_id
      and wm.user_id = auth.uid()
      and wm.status = 'active'
  )
);

drop policy if exists "task_comments_insert_workspace_members"
on public.task_comments;

create policy "task_comments_insert_workspace_members"
on public.task_comments
for insert
with check (
  author_user_id = auth.uid()
  and exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = task_comments.workspace_id
      and wm.user_id = auth.uid()
      and wm.status = 'active'
  )
);

create table if not exists public.project_comments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  author_user_id uuid references auth.users(id) on delete set null,
  author_member_id uuid references public.workspace_members(id) on delete set null,
  text text not null,
  created_at timestamptz not null default now()
);

create index if not exists project_comments_workspace_project_idx
on public.project_comments (workspace_id, project_id, created_at);

alter table public.project_comments enable row level security;

drop policy if exists "project_comments_select_workspace_members"
on public.project_comments;

create policy "project_comments_select_workspace_members"
on public.project_comments
for select
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = project_comments.workspace_id
      and wm.user_id = auth.uid()
      and wm.status = 'active'
  )
);

drop policy if exists "project_comments_insert_workspace_members"
on public.project_comments;

create policy "project_comments_insert_workspace_members"
on public.project_comments
for insert
with check (
  author_user_id = auth.uid()
  and exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = project_comments.workspace_id
      and wm.user_id = auth.uid()
      and wm.status = 'active'
  )
);
