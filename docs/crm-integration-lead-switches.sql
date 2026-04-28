alter table public.avito_report_accounts
  add column if not exists crm_dialogs_enabled boolean not null default true;

create table if not exists public.crm_integration_settings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  source_kind text not null,
  is_lead_ingestion_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, source_kind),
  check (source_kind in ('avito', 'tilda', 'telegram', 'yandex_direct'))
);

alter table public.crm_integration_settings enable row level security;

drop policy if exists "crm integration settings are visible for workspace members"
  on public.crm_integration_settings;

create policy "crm integration settings are visible for workspace members"
  on public.crm_integration_settings
  for select
  using (
    exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = crm_integration_settings.workspace_id
        and wm.user_id = auth.uid()
        and wm.status = 'active'
    )
  );

drop policy if exists "crm integration settings are manageable for workspace members"
  on public.crm_integration_settings;

create policy "crm integration settings are manageable for workspace members"
  on public.crm_integration_settings
  for all
  using (
    exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = crm_integration_settings.workspace_id
        and wm.user_id = auth.uid()
        and wm.status = 'active'
    )
  )
  with check (
    exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = crm_integration_settings.workspace_id
        and wm.user_id = auth.uid()
        and wm.status = 'active'
    )
  );

insert into public.crm_integration_settings (
  workspace_id,
  source_kind,
  is_lead_ingestion_enabled
)
select w.id, sources.source_kind, true
from public.workspaces w
cross join (
  values ('avito'), ('tilda'), ('telegram'), ('yandex_direct')
) as sources(source_kind)
on conflict (workspace_id, source_kind) do nothing;
