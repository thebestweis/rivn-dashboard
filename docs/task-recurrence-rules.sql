create table if not exists public.task_recurrence_rules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  template_task_id uuid references public.tasks(id) on delete set null,
  project_id uuid references public.projects(id) on delete cascade,
  parent_task_id uuid references public.tasks(id) on delete cascade,
  title text not null,
  description text,
  assignee_ids uuid[] not null default '{}',
  frequency text not null check (frequency in ('daily', 'weekly', 'monthly')),
  interval_value integer not null default 1 check (interval_value > 0),
  weekdays integer[] not null default '{}',
  month_day integer check (month_day is null or month_day between 1 and 31),
  starts_at timestamptz not null,
  ends_at timestamptz,
  next_run_at timestamptz not null,
  last_run_at timestamptz,
  deadline_time text,
  is_active boolean not null default true,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tasks
add column if not exists recurrence_rule_id uuid references public.task_recurrence_rules(id) on delete set null;

alter table public.tasks
add column if not exists recurrence_occurrence_date date;

create unique index if not exists tasks_recurrence_unique_occurrence
on public.tasks (recurrence_rule_id, recurrence_occurrence_date)
where recurrence_rule_id is not null and recurrence_occurrence_date is not null;

create index if not exists task_recurrence_rules_due_idx
on public.task_recurrence_rules (is_active, next_run_at);

create index if not exists task_recurrence_rules_workspace_idx
on public.task_recurrence_rules (workspace_id, is_active);

alter table public.task_recurrence_rules enable row level security;

drop policy if exists "task_recurrence_rules_select_workspace_members"
on public.task_recurrence_rules;

create policy "task_recurrence_rules_select_workspace_members"
on public.task_recurrence_rules
for select
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = task_recurrence_rules.workspace_id
      and wm.user_id = auth.uid()
      and wm.status = 'active'
  )
);

drop policy if exists "task_recurrence_rules_insert_workspace_members"
on public.task_recurrence_rules;

create policy "task_recurrence_rules_insert_workspace_members"
on public.task_recurrence_rules
for insert
with check (
  created_by = auth.uid()
  and exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = task_recurrence_rules.workspace_id
      and wm.user_id = auth.uid()
      and wm.status = 'active'
  )
);

drop policy if exists "task_recurrence_rules_update_workspace_members"
on public.task_recurrence_rules;

create policy "task_recurrence_rules_update_workspace_members"
on public.task_recurrence_rules
for update
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = task_recurrence_rules.workspace_id
      and wm.user_id = auth.uid()
      and wm.status = 'active'
  )
)
with check (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = task_recurrence_rules.workspace_id
      and wm.user_id = auth.uid()
      and wm.status = 'active'
  )
);
