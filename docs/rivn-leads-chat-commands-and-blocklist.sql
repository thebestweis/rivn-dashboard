-- RIVN Leads: Telegram chat commands and per-project author blocklist.
-- Run once in Supabase SQL Editor before deploying the workers.

alter table public.rivn_leads_telegram_messages
  add column if not exists author_id text;

create table if not exists public.rivn_leads_blocked_authors (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.rivn_leads_projects(id) on delete cascade,
  author_key text not null,
  author_id text,
  author_username text,
  author_name text,
  blocked_by_telegram_id text,
  blocked_by_username text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, author_key)
);

create index if not exists rivn_leads_messages_author_id_idx
  on public.rivn_leads_telegram_messages(author_id);

create index if not exists rivn_leads_blocked_authors_project_key_idx
  on public.rivn_leads_blocked_authors(project_id, author_key);

alter table public.rivn_leads_blocked_authors enable row level security;

drop policy if exists rivn_leads_blocked_authors_super_admin_all
  on public.rivn_leads_blocked_authors;

create policy rivn_leads_blocked_authors_super_admin_all
on public.rivn_leads_blocked_authors
for all
to authenticated
using (public.rivn_leads_is_super_admin())
with check (public.rivn_leads_is_super_admin());

drop policy if exists rivn_leads_blocked_authors_project_select
  on public.rivn_leads_blocked_authors;

create policy rivn_leads_blocked_authors_project_select
on public.rivn_leads_blocked_authors
for select
to authenticated
using (
  public.rivn_leads_is_super_admin()
  or exists (
    select 1
    from public.rivn_leads_projects p
    where p.id = rivn_leads_blocked_authors.project_id
      and public.rivn_leads_is_workspace_member(p.workspace_id)
  )
);
