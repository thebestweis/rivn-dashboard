-- RIVN OS CRM base schema.
-- Run this in Supabase SQL Editor before opening /crm in production.

create extension if not exists "pgcrypto";

create table if not exists public.crm_pipelines (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  kind text not null default 'sales' check (kind in ('sales', 'delivery')),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crm_pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  pipeline_id uuid not null references public.crm_pipelines(id) on delete cascade,
  name text not null,
  kind text not null default 'regular' check (kind in ('regular', 'payment', 'paid_project', 'lost', 'delivery')),
  sort_order integer not null default 0,
  color text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crm_sources (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  kind text not null default 'manual',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.crm_loss_reasons (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.crm_deals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  pipeline_id uuid not null references public.crm_pipelines(id) on delete restrict,
  stage_id uuid not null references public.crm_pipeline_stages(id) on delete restrict,
  client_id uuid references public.clients(id) on delete set null,
  title text not null,
  client_name text,
  phone text,
  telegram text,
  source_id uuid references public.crm_sources(id) on delete set null,
  source_item_id text,
  source_item_title text,
  source_item_url text,
  service_amount numeric,
  budget numeric,
  next_contact_at timestamptz,
  description text,
  status text not null default 'open' check (status in ('open', 'won', 'lost')),
  loss_reason_id uuid references public.crm_loss_reasons(id) on delete set null,
  loss_comment text,
  project_id uuid references public.projects(id) on delete set null,
  position bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crm_deal_assignees (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  deal_id uuid not null references public.crm_deals(id) on delete cascade,
  workspace_member_id uuid not null references public.workspace_members(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (deal_id, workspace_member_id)
);

create table if not exists public.crm_deal_activities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  deal_id uuid not null references public.crm_deals(id) on delete cascade,
  actor_member_id uuid references public.workspace_members(id) on delete set null,
  action text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.crm_deal_comments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  deal_id uuid not null references public.crm_deals(id) on delete cascade,
  author_member_id uuid references public.workspace_members(id) on delete set null,
  body text not null,
  file_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.crm_deal_tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  deal_id uuid not null references public.crm_deals(id) on delete cascade,
  title text not null,
  assignee_member_id uuid references public.workspace_members(id) on delete set null,
  due_at timestamptz,
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'done')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crm_conversations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  deal_id uuid references public.crm_deals(id) on delete cascade,
  channel text not null check (channel in ('avito', 'telegram', 'tilda', 'yandex_direct', 'manual')),
  external_id text,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crm_messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  conversation_id uuid not null references public.crm_conversations(id) on delete cascade,
  deal_id uuid references public.crm_deals(id) on delete cascade,
  sender_type text not null check (sender_type in ('client', 'manager', 'system')),
  sender_member_id uuid references public.workspace_members(id) on delete set null,
  body text,
  attachment_url text,
  external_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.crm_assignment_rules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  source_kind text,
  mode text not null default 'manual' check (mode in ('manual', 'round_robin', 'least_loaded', 'fixed_manager')),
  target_member_ids uuid[] not null default array[]::uuid[],
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists crm_pipelines_workspace_idx on public.crm_pipelines(workspace_id, sort_order);
create index if not exists crm_stages_pipeline_idx on public.crm_pipeline_stages(pipeline_id, sort_order);
create index if not exists crm_sources_workspace_idx on public.crm_sources(workspace_id);
create index if not exists crm_loss_reasons_workspace_idx on public.crm_loss_reasons(workspace_id, sort_order);
create index if not exists crm_deals_workspace_stage_idx on public.crm_deals(workspace_id, pipeline_id, stage_id, position);
create index if not exists crm_deals_next_contact_idx on public.crm_deals(workspace_id, next_contact_at);
create index if not exists crm_deals_source_item_idx on public.crm_deals(workspace_id, source_item_id);
create index if not exists crm_deal_assignees_member_idx on public.crm_deal_assignees(workspace_id, workspace_member_id);
create index if not exists crm_activities_deal_idx on public.crm_deal_activities(deal_id, created_at desc);
create index if not exists crm_comments_deal_idx on public.crm_deal_comments(deal_id, created_at desc);
create index if not exists crm_tasks_deal_idx on public.crm_deal_tasks(deal_id, status, due_at);
create index if not exists crm_conversations_deal_idx on public.crm_conversations(deal_id, channel);
create index if not exists crm_messages_conversation_idx on public.crm_messages(conversation_id, created_at);

-- Optional if workspace_members.role is a text column with a check constraint.
-- If your database uses an enum instead, do not run this block and add enum values separately.
alter table public.workspace_members
  drop constraint if exists workspace_members_role_check;

alter table public.workspace_members
  add constraint workspace_members_role_check
  check (role in ('owner', 'admin', 'manager', 'analyst', 'employee', 'sales_head', 'sales_manager'));
