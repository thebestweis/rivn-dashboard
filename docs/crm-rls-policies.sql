-- RIVN OS CRM RLS policies.
-- Run this after docs/crm-supabase-schema.sql if /crm shows row-level security errors.

alter table public.crm_pipelines enable row level security;
alter table public.crm_pipeline_stages enable row level security;
alter table public.crm_sources enable row level security;
alter table public.crm_loss_reasons enable row level security;
alter table public.crm_deals enable row level security;
alter table public.crm_deal_assignees enable row level security;
alter table public.crm_deal_activities enable row level security;
alter table public.crm_deal_comments enable row level security;
alter table public.crm_deal_tasks enable row level security;
alter table public.crm_conversations enable row level security;
alter table public.crm_messages enable row level security;
alter table public.crm_assignment_rules enable row level security;

drop policy if exists crm_pipelines_workspace_members_all on public.crm_pipelines;
create policy crm_pipelines_workspace_members_all
on public.crm_pipelines
for all
to authenticated
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = crm_pipelines.workspace_id
      and wm.user_id = auth.uid()
      and wm.status = 'active'
  )
)
with check (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = crm_pipelines.workspace_id
      and wm.user_id = auth.uid()
      and wm.status = 'active'
      and wm.role in ('owner', 'admin', 'manager', 'sales_head')
  )
);

drop policy if exists crm_pipeline_stages_workspace_members_all on public.crm_pipeline_stages;
create policy crm_pipeline_stages_workspace_members_all
on public.crm_pipeline_stages
for all
to authenticated
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = crm_pipeline_stages.workspace_id
      and wm.user_id = auth.uid()
      and wm.status = 'active'
  )
)
with check (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = crm_pipeline_stages.workspace_id
      and wm.user_id = auth.uid()
      and wm.status = 'active'
      and wm.role in ('owner', 'admin', 'manager', 'sales_head')
  )
);

drop policy if exists crm_sources_workspace_members_all on public.crm_sources;
create policy crm_sources_workspace_members_all
on public.crm_sources
for all
to authenticated
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = crm_sources.workspace_id
      and wm.user_id = auth.uid()
      and wm.status = 'active'
  )
)
with check (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = crm_sources.workspace_id
      and wm.user_id = auth.uid()
      and wm.status = 'active'
      and wm.role in ('owner', 'admin', 'manager', 'sales_head')
  )
);

drop policy if exists crm_loss_reasons_workspace_members_all on public.crm_loss_reasons;
create policy crm_loss_reasons_workspace_members_all
on public.crm_loss_reasons
for all
to authenticated
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = crm_loss_reasons.workspace_id
      and wm.user_id = auth.uid()
      and wm.status = 'active'
  )
)
with check (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = crm_loss_reasons.workspace_id
      and wm.user_id = auth.uid()
      and wm.status = 'active'
      and wm.role in ('owner', 'admin', 'manager', 'sales_head')
  )
);

drop policy if exists crm_deals_workspace_members_select on public.crm_deals;
create policy crm_deals_workspace_members_select
on public.crm_deals
for select
to authenticated
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = crm_deals.workspace_id
      and wm.user_id = auth.uid()
      and wm.status = 'active'
      and (
        wm.role in ('owner', 'admin', 'manager', 'sales_head')
        or exists (
          select 1
          from public.crm_deal_assignees cda
          where cda.deal_id = crm_deals.id
            and cda.workspace_member_id = wm.id
        )
      )
  )
);

drop policy if exists crm_deals_workspace_members_insert on public.crm_deals;
create policy crm_deals_workspace_members_insert
on public.crm_deals
for insert
to authenticated
with check (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = crm_deals.workspace_id
      and wm.user_id = auth.uid()
      and wm.status = 'active'
      and wm.role in ('owner', 'admin', 'manager', 'sales_head', 'sales_manager')
  )
);

drop policy if exists crm_deals_workspace_members_update on public.crm_deals;
create policy crm_deals_workspace_members_update
on public.crm_deals
for update
to authenticated
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = crm_deals.workspace_id
      and wm.user_id = auth.uid()
      and wm.status = 'active'
      and (
        wm.role in ('owner', 'admin', 'manager', 'sales_head')
        or exists (
          select 1
          from public.crm_deal_assignees cda
          where cda.deal_id = crm_deals.id
            and cda.workspace_member_id = wm.id
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = crm_deals.workspace_id
      and wm.user_id = auth.uid()
      and wm.status = 'active'
      and (
        wm.role in ('owner', 'admin', 'manager', 'sales_head')
        or exists (
          select 1
          from public.crm_deal_assignees cda
          where cda.deal_id = crm_deals.id
            and cda.workspace_member_id = wm.id
        )
      )
  )
);

drop policy if exists crm_deals_workspace_admin_delete on public.crm_deals;
create policy crm_deals_workspace_admin_delete
on public.crm_deals
for delete
to authenticated
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = crm_deals.workspace_id
      and wm.user_id = auth.uid()
      and wm.status = 'active'
      and wm.role in ('owner', 'admin', 'manager', 'sales_head')
  )
);

drop policy if exists crm_deal_assignees_workspace_members_all on public.crm_deal_assignees;
create policy crm_deal_assignees_workspace_members_all
on public.crm_deal_assignees
for all
to authenticated
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = crm_deal_assignees.workspace_id
      and wm.user_id = auth.uid()
      and wm.status = 'active'
  )
)
with check (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = crm_deal_assignees.workspace_id
      and wm.user_id = auth.uid()
      and wm.status = 'active'
      and wm.role in ('owner', 'admin', 'manager', 'sales_head', 'sales_manager')
  )
);

drop policy if exists crm_deal_activities_workspace_members_all on public.crm_deal_activities;
create policy crm_deal_activities_workspace_members_all
on public.crm_deal_activities
for all
to authenticated
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = crm_deal_activities.workspace_id
      and wm.user_id = auth.uid()
      and wm.status = 'active'
  )
)
with check (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = crm_deal_activities.workspace_id
      and wm.user_id = auth.uid()
      and wm.status = 'active'
  )
);

drop policy if exists crm_deal_comments_workspace_members_all on public.crm_deal_comments;
create policy crm_deal_comments_workspace_members_all
on public.crm_deal_comments
for all
to authenticated
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = crm_deal_comments.workspace_id
      and wm.user_id = auth.uid()
      and wm.status = 'active'
  )
)
with check (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = crm_deal_comments.workspace_id
      and wm.user_id = auth.uid()
      and wm.status = 'active'
  )
);

drop policy if exists crm_deal_tasks_workspace_members_all on public.crm_deal_tasks;
create policy crm_deal_tasks_workspace_members_all
on public.crm_deal_tasks
for all
to authenticated
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = crm_deal_tasks.workspace_id
      and wm.user_id = auth.uid()
      and wm.status = 'active'
  )
)
with check (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = crm_deal_tasks.workspace_id
      and wm.user_id = auth.uid()
      and wm.status = 'active'
  )
);

drop policy if exists crm_conversations_workspace_members_all on public.crm_conversations;
create policy crm_conversations_workspace_members_all
on public.crm_conversations
for all
to authenticated
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = crm_conversations.workspace_id
      and wm.user_id = auth.uid()
      and wm.status = 'active'
  )
)
with check (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = crm_conversations.workspace_id
      and wm.user_id = auth.uid()
      and wm.status = 'active'
  )
);

drop policy if exists crm_messages_workspace_members_all on public.crm_messages;
create policy crm_messages_workspace_members_all
on public.crm_messages
for all
to authenticated
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = crm_messages.workspace_id
      and wm.user_id = auth.uid()
      and wm.status = 'active'
  )
)
with check (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = crm_messages.workspace_id
      and wm.user_id = auth.uid()
      and wm.status = 'active'
  )
);

drop policy if exists crm_assignment_rules_workspace_members_all on public.crm_assignment_rules;
create policy crm_assignment_rules_workspace_members_all
on public.crm_assignment_rules
for all
to authenticated
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = crm_assignment_rules.workspace_id
      and wm.user_id = auth.uid()
      and wm.status = 'active'
  )
)
with check (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = crm_assignment_rules.workspace_id
      and wm.user_id = auth.uid()
      and wm.status = 'active'
      and wm.role in ('owner', 'admin', 'manager', 'sales_head')
  )
);
