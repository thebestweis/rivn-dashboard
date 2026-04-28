create table if not exists public.avito_report_item_cache (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.avito_report_accounts(id) on delete cascade,
  avito_user_id text,
  item_ids jsonb not null default '[]'::jsonb,
  next_page integer not null default 1,
  is_complete boolean not null default true,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(account_id)
);

alter table public.avito_report_item_cache
  add column if not exists next_page integer not null default 1;

alter table public.avito_report_item_cache
  add column if not exists is_complete boolean not null default true;

create index if not exists avito_report_item_cache_account_idx
  on public.avito_report_item_cache(account_id);

create index if not exists avito_report_item_cache_fetched_at_idx
  on public.avito_report_item_cache(fetched_at desc);

alter table public.avito_report_item_cache enable row level security;

create table if not exists public.avito_report_stats_cache (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.avito_report_accounts(id) on delete cascade,
  avito_user_id text not null,
  date_from date not null,
  date_to date not null,
  item_ids_hash text not null,
  views integer not null default 0,
  contacts integer not null default 0,
  favorites integer not null default 0,
  processed_chunks integer not null default 0,
  total_chunks integer not null default 0,
  is_complete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(account_id, date_from, date_to)
);

create index if not exists avito_report_stats_cache_account_idx
  on public.avito_report_stats_cache(account_id);

create index if not exists avito_report_stats_cache_period_idx
  on public.avito_report_stats_cache(date_from, date_to);

create index if not exists avito_report_stats_cache_complete_idx
  on public.avito_report_stats_cache(is_complete)
  where is_complete = true;

alter table public.avito_report_stats_cache enable row level security;

-- Recommended external warmup route for large Avito accounts:
-- https://rivn-dashboard.vercel.app/api/cron/avito-cache-warmup?secret=CRON_SECRET
-- Run it before daily reports, for example at 08:00, 08:15, 08:30 and 08:45 Moscow time.
