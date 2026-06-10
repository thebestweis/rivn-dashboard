-- Fix duplicated workspace billing rows and prevent the issue from returning.
-- Run this once in Supabase SQL editor before or after deploying the code fix.

with ranked_billing as (
  select
    id,
    row_number() over (
      partition by workspace_id
      order by updated_at desc nulls last, created_at desc nulls last, id desc
    ) as row_number
  from public.workspace_billing
)
delete from public.workspace_billing billing
using ranked_billing ranked
where billing.id = ranked.id
  and ranked.row_number > 1;

create unique index if not exists workspace_billing_workspace_id_unique
  on public.workspace_billing (workspace_id);
