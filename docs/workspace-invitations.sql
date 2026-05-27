-- RIVN OS workspace invitations.
-- Run this once in Supabase SQL Editor before using email/manual invite links.

create table if not exists public.workspace_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email text not null,
  role text not null
    check (role in ('owner', 'admin', 'manager', 'analyst', 'employee', 'sales_head', 'sales_manager')),
  token_hash text not null unique,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'canceled', 'expired')),
  invited_by uuid references auth.users(id) on delete set null,
  accepted_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists workspace_invitations_workspace_status_idx
  on public.workspace_invitations (workspace_id, status, created_at desc);

create index if not exists workspace_invitations_email_status_idx
  on public.workspace_invitations (email, status);

create unique index if not exists workspace_invitations_pending_email_idx
  on public.workspace_invitations (workspace_id, lower(email))
  where status = 'pending';

alter table public.workspace_invitations enable row level security;

drop policy if exists workspace_invitations_select_workspace_admins on public.workspace_invitations;
create policy workspace_invitations_select_workspace_admins
on public.workspace_invitations
for select
to authenticated
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = workspace_invitations.workspace_id
      and wm.user_id = auth.uid()
      and wm.status = 'active'
      and wm.role in ('owner', 'admin')
  )
);

drop policy if exists workspace_invitations_insert_workspace_admins on public.workspace_invitations;
create policy workspace_invitations_insert_workspace_admins
on public.workspace_invitations
for insert
to authenticated
with check (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = workspace_invitations.workspace_id
      and wm.user_id = auth.uid()
      and wm.status = 'active'
      and wm.role in ('owner', 'admin')
  )
);

drop policy if exists workspace_invitations_update_workspace_admins on public.workspace_invitations;
create policy workspace_invitations_update_workspace_admins
on public.workspace_invitations
for update
to authenticated
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = workspace_invitations.workspace_id
      and wm.user_id = auth.uid()
      and wm.status = 'active'
      and wm.role in ('owner', 'admin')
  )
)
with check (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = workspace_invitations.workspace_id
      and wm.user_id = auth.uid()
      and wm.status = 'active'
      and wm.role in ('owner', 'admin')
  )
);
