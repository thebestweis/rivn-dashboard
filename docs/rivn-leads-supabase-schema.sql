-- RIVN Leads base schema for RIVN OS.
-- Step 1 of integration: database foundation only.
-- Run this in Supabase SQL Editor before adding /admin-leads UI and workers.

create extension if not exists "pgcrypto";

create or replace function public.rivn_leads_is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.platform_role = 'super_admin'
  );
$$;

create or replace function public.rivn_leads_is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = auth.uid()
      and wm.status = 'active'
  );
$$;

create or replace function public.rivn_leads_can_manage_workspace(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.rivn_leads_is_super_admin()
    or exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = target_workspace_id
        and wm.user_id = auth.uid()
        and wm.status = 'active'
        and wm.role in ('owner', 'admin', 'manager', 'sales_head')
    );
$$;

create table if not exists public.rivn_leads_reader_accounts (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  phone_hint text,
  encrypted_session_string text not null,
  encryption_key_id text not null,
  status text not null default 'auth_required'
    check (status in ('active', 'paused', 'auth_required', 'banned', 'error')),
  assigned_niche text,
  last_seen_at timestamptz,
  last_error text,
  max_chats_limit integer not null default 50,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rivn_leads_source_chat_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rivn_leads_source_chats (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.rivn_leads_source_chat_categories(id) on delete restrict,
  reader_account_id uuid references public.rivn_leads_reader_accounts(id) on delete set null,
  title text not null,
  telegram_chat_id text not null unique,
  username text,
  invite_link text,
  type text not null default 'group'
    check (type in ('group', 'supergroup', 'channel_discussion')),
  access_level text not null default 'private'
    check (access_level in ('public', 'private', 'special')),
  status text not null default 'pending_access'
    check (status in ('active', 'paused', 'pending_access', 'access_lost', 'error')),
  member_count integer,
  last_checked_at timestamptz,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rivn_leads_projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  reader_account_id uuid references public.rivn_leads_reader_accounts(id) on delete set null,
  name text not null,
  niche text not null default 'general',
  status text not null default 'draft'
    check (status in ('draft', 'active', 'paused', 'archived')),
  destination_chat_id text,
  telegram_connect_code text unique,
  telegram_connect_code_expires_at timestamptz,
  telegram_bot_added boolean not null default false,
  daily_lead_limit integer,
  monthly_lead_limit integer,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rivn_leads_project_source_chats (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.rivn_leads_projects(id) on delete cascade,
  source_chat_id uuid not null references public.rivn_leads_source_chats(id) on delete cascade,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, source_chat_id)
);

create table if not exists public.rivn_leads_keywords (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.rivn_leads_projects(id) on delete cascade,
  value text not null,
  normalized_value text not null,
  match_type text not null default 'contains'
    check (match_type in ('contains', 'exact', 'fuzzy')),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, normalized_value)
);

create table if not exists public.rivn_leads_stop_words (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.rivn_leads_projects(id) on delete cascade,
  value text not null,
  normalized_value text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, normalized_value)
);

create table if not exists public.rivn_leads_special_chat_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.rivn_leads_projects(id) on delete cascade,
  chat_link text not null,
  comment text,
  status text not null default 'new'
    check (status in ('new', 'in_progress', 'connected', 'rejected', 'access_required')),
  admin_comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rivn_leads_telegram_messages (
  id uuid primary key default gen_random_uuid(),
  source_chat_id uuid not null references public.rivn_leads_source_chats(id) on delete cascade,
  telegram_chat_id text not null,
  telegram_message_id text not null,
  message_text text not null,
  normalized_text text not null,
  author_name text,
  author_username text,
  message_link text,
  message_date timestamptz not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  unique (telegram_chat_id, telegram_message_id)
);

create table if not exists public.rivn_leads_leads (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.rivn_leads_projects(id) on delete cascade,
  telegram_message_id uuid not null references public.rivn_leads_telegram_messages(id) on delete cascade,
  source_chat_id uuid not null references public.rivn_leads_source_chats(id) on delete restrict,
  status text not null default 'new'
    check (status in ('new', 'delivered', 'delivery_failed', 'marked_as_lead', 'marked_as_not_lead', 'expired')),
  matched_keywords jsonb not null default '[]'::jsonb,
  blocked_by_stop_words jsonb,
  delivered_at timestamptz,
  feedback text check (feedback in ('lead', 'not_lead')),
  feedback_at timestamptz,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  unique (project_id, telegram_message_id)
);

create table if not exists public.rivn_leads_processed_messages (
  id uuid primary key default gen_random_uuid(),
  telegram_chat_id text not null,
  telegram_message_id text not null,
  processed_at timestamptz not null default now(),
  unique (telegram_chat_id, telegram_message_id)
);

create table if not exists public.rivn_leads_delivery_logs (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.rivn_leads_leads(id) on delete cascade,
  project_id uuid not null references public.rivn_leads_projects(id) on delete cascade,
  destination_chat_id text not null,
  telegram_bot_message_id text,
  status text not null
    check (status in ('pending', 'sent', 'failed', 'retrying')),
  error_message text,
  created_at timestamptz not null default now()
);

create table if not exists public.rivn_leads_daily_reports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.rivn_leads_projects(id) on delete cascade,
  report_date date not null,
  leads_found integer not null default 0,
  sent_at timestamptz,
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'failed', 'skipped')),
  created_at timestamptz not null default now(),
  unique (project_id, report_date)
);

create table if not exists public.rivn_leads_audit_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists rivn_leads_reader_accounts_status_idx
  on public.rivn_leads_reader_accounts(status, assigned_niche);
create index if not exists rivn_leads_source_chats_category_status_idx
  on public.rivn_leads_source_chats(category_id, status);
create index if not exists rivn_leads_source_chats_reader_status_idx
  on public.rivn_leads_source_chats(reader_account_id, status);
create index if not exists rivn_leads_projects_workspace_status_idx
  on public.rivn_leads_projects(workspace_id, status);
create index if not exists rivn_leads_projects_reader_status_idx
  on public.rivn_leads_projects(reader_account_id, status);
create index if not exists rivn_leads_project_source_chats_source_idx
  on public.rivn_leads_project_source_chats(source_chat_id, enabled);
create index if not exists rivn_leads_keywords_project_enabled_idx
  on public.rivn_leads_keywords(project_id, enabled);
create index if not exists rivn_leads_stop_words_project_enabled_idx
  on public.rivn_leads_stop_words(project_id, enabled);
create index if not exists rivn_leads_special_requests_project_status_idx
  on public.rivn_leads_special_chat_requests(project_id, status);
create index if not exists rivn_leads_messages_source_date_idx
  on public.rivn_leads_telegram_messages(source_chat_id, message_date);
create index if not exists rivn_leads_messages_expires_idx
  on public.rivn_leads_telegram_messages(expires_at);
create index if not exists rivn_leads_leads_project_status_created_idx
  on public.rivn_leads_leads(project_id, status, created_at desc);
create index if not exists rivn_leads_leads_source_created_idx
  on public.rivn_leads_leads(source_chat_id, created_at desc);
create index if not exists rivn_leads_leads_expires_idx
  on public.rivn_leads_leads(expires_at);
create index if not exists rivn_leads_processed_messages_processed_idx
  on public.rivn_leads_processed_messages(processed_at);
create index if not exists rivn_leads_delivery_logs_lead_created_idx
  on public.rivn_leads_delivery_logs(lead_id, created_at desc);
create index if not exists rivn_leads_delivery_logs_project_status_created_idx
  on public.rivn_leads_delivery_logs(project_id, status, created_at desc);
create index if not exists rivn_leads_daily_reports_status_date_idx
  on public.rivn_leads_daily_reports(status, report_date);
create index if not exists rivn_leads_audit_logs_workspace_created_idx
  on public.rivn_leads_audit_logs(workspace_id, created_at desc);
create index if not exists rivn_leads_audit_logs_entity_idx
  on public.rivn_leads_audit_logs(entity_type, entity_id);

alter table public.rivn_leads_reader_accounts enable row level security;
alter table public.rivn_leads_source_chat_categories enable row level security;
alter table public.rivn_leads_source_chats enable row level security;
alter table public.rivn_leads_projects enable row level security;
alter table public.rivn_leads_project_source_chats enable row level security;
alter table public.rivn_leads_keywords enable row level security;
alter table public.rivn_leads_stop_words enable row level security;
alter table public.rivn_leads_special_chat_requests enable row level security;
alter table public.rivn_leads_telegram_messages enable row level security;
alter table public.rivn_leads_leads enable row level security;
alter table public.rivn_leads_processed_messages enable row level security;
alter table public.rivn_leads_delivery_logs enable row level security;
alter table public.rivn_leads_daily_reports enable row level security;
alter table public.rivn_leads_audit_logs enable row level security;

drop policy if exists rivn_leads_reader_accounts_super_admin_all on public.rivn_leads_reader_accounts;
create policy rivn_leads_reader_accounts_super_admin_all
on public.rivn_leads_reader_accounts
for all
to authenticated
using (public.rivn_leads_is_super_admin())
with check (public.rivn_leads_is_super_admin());

drop policy if exists rivn_leads_source_categories_super_admin_all on public.rivn_leads_source_chat_categories;
create policy rivn_leads_source_categories_super_admin_all
on public.rivn_leads_source_chat_categories
for all
to authenticated
using (public.rivn_leads_is_super_admin())
with check (public.rivn_leads_is_super_admin());

drop policy if exists rivn_leads_source_chats_super_admin_all on public.rivn_leads_source_chats;
create policy rivn_leads_source_chats_super_admin_all
on public.rivn_leads_source_chats
for all
to authenticated
using (public.rivn_leads_is_super_admin())
with check (public.rivn_leads_is_super_admin());

drop policy if exists rivn_leads_projects_workspace_select on public.rivn_leads_projects;
create policy rivn_leads_projects_workspace_select
on public.rivn_leads_projects
for select
to authenticated
using (
  public.rivn_leads_is_super_admin()
  or public.rivn_leads_is_workspace_member(workspace_id)
);

drop policy if exists rivn_leads_projects_workspace_manage on public.rivn_leads_projects;
create policy rivn_leads_projects_workspace_manage
on public.rivn_leads_projects
for all
to authenticated
using (
  public.rivn_leads_is_super_admin()
  or public.rivn_leads_can_manage_workspace(workspace_id)
)
with check (
  public.rivn_leads_is_super_admin()
  or public.rivn_leads_can_manage_workspace(workspace_id)
);

drop policy if exists rivn_leads_project_source_chats_project_access on public.rivn_leads_project_source_chats;
create policy rivn_leads_project_source_chats_project_access
on public.rivn_leads_project_source_chats
for all
to authenticated
using (
  public.rivn_leads_is_super_admin()
  or exists (
    select 1
    from public.rivn_leads_projects p
    where p.id = rivn_leads_project_source_chats.project_id
      and public.rivn_leads_is_workspace_member(p.workspace_id)
  )
)
with check (
  public.rivn_leads_is_super_admin()
  or exists (
    select 1
    from public.rivn_leads_projects p
    where p.id = rivn_leads_project_source_chats.project_id
      and public.rivn_leads_can_manage_workspace(p.workspace_id)
  )
);

drop policy if exists rivn_leads_keywords_project_access on public.rivn_leads_keywords;
create policy rivn_leads_keywords_project_access
on public.rivn_leads_keywords
for all
to authenticated
using (
  public.rivn_leads_is_super_admin()
  or exists (
    select 1
    from public.rivn_leads_projects p
    where p.id = rivn_leads_keywords.project_id
      and public.rivn_leads_is_workspace_member(p.workspace_id)
  )
)
with check (
  public.rivn_leads_is_super_admin()
  or exists (
    select 1
    from public.rivn_leads_projects p
    where p.id = rivn_leads_keywords.project_id
      and public.rivn_leads_can_manage_workspace(p.workspace_id)
  )
);

drop policy if exists rivn_leads_stop_words_project_access on public.rivn_leads_stop_words;
create policy rivn_leads_stop_words_project_access
on public.rivn_leads_stop_words
for all
to authenticated
using (
  public.rivn_leads_is_super_admin()
  or exists (
    select 1
    from public.rivn_leads_projects p
    where p.id = rivn_leads_stop_words.project_id
      and public.rivn_leads_is_workspace_member(p.workspace_id)
  )
)
with check (
  public.rivn_leads_is_super_admin()
  or exists (
    select 1
    from public.rivn_leads_projects p
    where p.id = rivn_leads_stop_words.project_id
      and public.rivn_leads_can_manage_workspace(p.workspace_id)
  )
);

drop policy if exists rivn_leads_special_requests_project_access on public.rivn_leads_special_chat_requests;
create policy rivn_leads_special_requests_project_access
on public.rivn_leads_special_chat_requests
for all
to authenticated
using (
  public.rivn_leads_is_super_admin()
  or exists (
    select 1
    from public.rivn_leads_projects p
    where p.id = rivn_leads_special_chat_requests.project_id
      and public.rivn_leads_is_workspace_member(p.workspace_id)
  )
)
with check (
  public.rivn_leads_is_super_admin()
  or exists (
    select 1
    from public.rivn_leads_projects p
    where p.id = rivn_leads_special_chat_requests.project_id
      and public.rivn_leads_can_manage_workspace(p.workspace_id)
  )
);

drop policy if exists rivn_leads_telegram_messages_super_admin_select on public.rivn_leads_telegram_messages;
create policy rivn_leads_telegram_messages_super_admin_select
on public.rivn_leads_telegram_messages
for select
to authenticated
using (public.rivn_leads_is_super_admin());

drop policy if exists rivn_leads_leads_project_select on public.rivn_leads_leads;
create policy rivn_leads_leads_project_select
on public.rivn_leads_leads
for select
to authenticated
using (
  public.rivn_leads_is_super_admin()
  or exists (
    select 1
    from public.rivn_leads_projects p
    where p.id = rivn_leads_leads.project_id
      and public.rivn_leads_is_workspace_member(p.workspace_id)
  )
);

drop policy if exists rivn_leads_leads_project_update on public.rivn_leads_leads;
create policy rivn_leads_leads_project_update
on public.rivn_leads_leads
for update
to authenticated
using (
  public.rivn_leads_is_super_admin()
  or exists (
    select 1
    from public.rivn_leads_projects p
    where p.id = rivn_leads_leads.project_id
      and public.rivn_leads_can_manage_workspace(p.workspace_id)
  )
)
with check (
  public.rivn_leads_is_super_admin()
  or exists (
    select 1
    from public.rivn_leads_projects p
    where p.id = rivn_leads_leads.project_id
      and public.rivn_leads_can_manage_workspace(p.workspace_id)
  )
);

drop policy if exists rivn_leads_processed_messages_super_admin_select on public.rivn_leads_processed_messages;
create policy rivn_leads_processed_messages_super_admin_select
on public.rivn_leads_processed_messages
for select
to authenticated
using (public.rivn_leads_is_super_admin());

drop policy if exists rivn_leads_delivery_logs_project_select on public.rivn_leads_delivery_logs;
create policy rivn_leads_delivery_logs_project_select
on public.rivn_leads_delivery_logs
for select
to authenticated
using (
  public.rivn_leads_is_super_admin()
  or exists (
    select 1
    from public.rivn_leads_projects p
    where p.id = rivn_leads_delivery_logs.project_id
      and public.rivn_leads_is_workspace_member(p.workspace_id)
  )
);

drop policy if exists rivn_leads_daily_reports_project_select on public.rivn_leads_daily_reports;
create policy rivn_leads_daily_reports_project_select
on public.rivn_leads_daily_reports
for select
to authenticated
using (
  public.rivn_leads_is_super_admin()
  or exists (
    select 1
    from public.rivn_leads_projects p
    where p.id = rivn_leads_daily_reports.project_id
      and public.rivn_leads_is_workspace_member(p.workspace_id)
  )
);

drop policy if exists rivn_leads_audit_logs_super_admin_select on public.rivn_leads_audit_logs;
create policy rivn_leads_audit_logs_super_admin_select
on public.rivn_leads_audit_logs
for select
to authenticated
using (
  public.rivn_leads_is_super_admin()
  or (
    workspace_id is not null
    and public.rivn_leads_can_manage_workspace(workspace_id)
  )
);

insert into public.rivn_leads_source_chat_categories (name, slug, description)
values
  ('CRM и автоматизация', 'crm', 'Чаты про CRM, интеграции, автоматизацию и воронки продаж'),
  ('Маркетинг и реклама', 'marketing', 'Чаты про digital, рекламу, SMM, таргет и продвижение'),
  ('Бизнес и предприниматели', 'business', 'Бизнес-чаты, где могут появляться запросы на услуги')
on conflict (slug) do nothing;
