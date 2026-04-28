create table if not exists public.avito_report_item_cache (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.avito_report_accounts(id) on delete cascade,
  avito_user_id text,
  item_ids jsonb not null default '[]'::jsonb,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(account_id)
);

create index if not exists avito_report_item_cache_account_idx
  on public.avito_report_item_cache(account_id);

create index if not exists avito_report_item_cache_fetched_at_idx
  on public.avito_report_item_cache(fetched_at desc);

alter table public.avito_report_item_cache enable row level security;
