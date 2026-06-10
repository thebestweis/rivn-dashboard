alter table public.tasks
  add column if not exists is_hot boolean not null default false;

create index if not exists tasks_hot_priority_idx
  on public.tasks (workspace_id, is_hot, status, deadline_at, created_at);
