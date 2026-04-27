-- CRM stage movement history for exact funnel conversion.
-- Run this once in Supabase SQL editor.

create table if not exists public.crm_deal_stage_history (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  deal_id uuid not null references public.crm_deals(id) on delete cascade,
  from_pipeline_id uuid references public.crm_pipelines(id) on delete set null,
  from_stage_id uuid references public.crm_pipeline_stages(id) on delete set null,
  to_pipeline_id uuid not null references public.crm_pipelines(id) on delete restrict,
  to_stage_id uuid not null references public.crm_pipeline_stages(id) on delete restrict,
  actor_member_id uuid references public.workspace_members(id) on delete set null,
  moved_at timestamptz not null default now()
);

create index if not exists crm_stage_history_workspace_idx
on public.crm_deal_stage_history(workspace_id, moved_at desc);

create index if not exists crm_stage_history_deal_idx
on public.crm_deal_stage_history(deal_id, moved_at);

create index if not exists crm_stage_history_transition_idx
on public.crm_deal_stage_history(workspace_id, from_stage_id, to_stage_id, moved_at desc);

alter table public.crm_deal_stage_history enable row level security;

drop policy if exists crm_deal_stage_history_workspace_members_select on public.crm_deal_stage_history;
create policy crm_deal_stage_history_workspace_members_select
on public.crm_deal_stage_history
for select
to authenticated
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = crm_deal_stage_history.workspace_id
      and wm.user_id = auth.uid()
      and wm.status = 'active'
      and (
        wm.role in ('owner', 'admin', 'manager', 'sales_head')
        or exists (
          select 1
          from public.crm_deal_assignees cda
          where cda.deal_id = crm_deal_stage_history.deal_id
            and cda.workspace_member_id = wm.id
        )
      )
  )
);

drop policy if exists crm_deal_stage_history_workspace_members_insert on public.crm_deal_stage_history;
create policy crm_deal_stage_history_workspace_members_insert
on public.crm_deal_stage_history
for insert
to authenticated
with check (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = crm_deal_stage_history.workspace_id
      and wm.user_id = auth.uid()
      and wm.status = 'active'
      and (
        wm.role in ('owner', 'admin', 'manager', 'sales_head')
        or exists (
          select 1
          from public.crm_deal_assignees cda
          where cda.deal_id = crm_deal_stage_history.deal_id
            and cda.workspace_member_id = wm.id
        )
      )
  )
);

insert into public.crm_deal_stage_history (
  workspace_id,
  deal_id,
  from_pipeline_id,
  from_stage_id,
  to_pipeline_id,
  to_stage_id,
  actor_member_id,
  moved_at
)
select
  deal.workspace_id,
  deal.id,
  null,
  null,
  deal.pipeline_id,
  deal.stage_id,
  null,
  deal.created_at
from public.crm_deals deal
where not exists (
  select 1
  from public.crm_deal_stage_history history
  where history.deal_id = deal.id
);
