-- RIVN OS CRM sales plans.
-- Run this once in Supabase SQL Editor before using /crm/analytics -> Plan / fact.

create table if not exists public.crm_sales_plans (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  month text not null,
  revenue_plan numeric not null default 0,
  won_deals_plan integer not null default 0,
  leads_plan integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, month)
);

create index if not exists crm_sales_plans_workspace_month_idx
on public.crm_sales_plans(workspace_id, month);

alter table public.crm_sales_plans enable row level security;

drop policy if exists crm_sales_plans_workspace_members_all on public.crm_sales_plans;
create policy crm_sales_plans_workspace_members_all
on public.crm_sales_plans
for all
to authenticated
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = crm_sales_plans.workspace_id
      and wm.user_id = auth.uid()
      and wm.status = 'active'
  )
)
with check (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = crm_sales_plans.workspace_id
      and wm.user_id = auth.uid()
      and wm.status = 'active'
      and wm.role in ('owner', 'admin', 'manager', 'sales_head')
  )
);
