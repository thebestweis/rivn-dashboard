-- Run once in Supabase SQL Editor to show Avito ad data in CRM deals.

alter table public.crm_deals
  add column if not exists source_item_id text,
  add column if not exists source_item_title text,
  add column if not exists source_item_url text;

create index if not exists crm_deals_source_item_idx
  on public.crm_deals(workspace_id, source_item_id);
