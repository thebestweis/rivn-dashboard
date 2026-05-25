create table if not exists public.app_notifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text not null,
  kind text not null default 'info'
    check (kind in ('info', 'success', 'warning', 'danger', 'marketing')),
  link_url text,
  source text not null default 'system',
  created_by uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists app_notifications_recipient_created_idx
  on public.app_notifications (recipient_user_id, created_at desc);

create index if not exists app_notifications_recipient_unread_idx
  on public.app_notifications (recipient_user_id, read_at)
  where read_at is null;

create index if not exists app_notifications_workspace_created_idx
  on public.app_notifications (workspace_id, created_at desc);

alter table public.app_notifications enable row level security;

drop policy if exists app_notifications_select_own on public.app_notifications;
create policy app_notifications_select_own
on public.app_notifications
for select
to authenticated
using (recipient_user_id = auth.uid());

drop policy if exists app_notifications_update_own_read_at on public.app_notifications;
create policy app_notifications_update_own_read_at
on public.app_notifications
for update
to authenticated
using (recipient_user_id = auth.uid())
with check (recipient_user_id = auth.uid());
