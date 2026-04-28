create table if not exists public.crm_yandex_direct_integrations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null default 'Яндекс Директ',
  oauth_token text not null,
  client_login text,
  turbo_page_ids bigint[] not null default '{}',
  is_active boolean not null default true,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists crm_yandex_direct_integrations_workspace_idx
  on public.crm_yandex_direct_integrations(workspace_id);

create index if not exists crm_yandex_direct_integrations_active_idx
  on public.crm_yandex_direct_integrations(is_active)
  where is_active = true;

create table if not exists public.crm_yandex_direct_imports (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  integration_id uuid not null references public.crm_yandex_direct_integrations(id) on delete cascade,
  external_lead_id text not null,
  deal_id uuid references public.crm_deals(id) on delete set null,
  submitted_at timestamptz,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(integration_id, external_lead_id)
);

create index if not exists crm_yandex_direct_imports_workspace_idx
  on public.crm_yandex_direct_imports(workspace_id);

create index if not exists crm_yandex_direct_imports_integration_idx
  on public.crm_yandex_direct_imports(integration_id);

create index if not exists crm_yandex_direct_imports_submitted_at_idx
  on public.crm_yandex_direct_imports(submitted_at desc);

alter table public.crm_yandex_direct_integrations enable row level security;
alter table public.crm_yandex_direct_imports enable row level security;
