-- Iteration 11: reliable Avito report snapshots and retry queue.
-- Safe to run more than once. Also safe if tables were already created partially.

create table if not exists public.avito_report_snapshots (
  id uuid primary key default gen_random_uuid()
);

alter table public.avito_report_snapshots
  add column if not exists client_id uuid references public.avito_report_clients(id) on delete cascade,
  add column if not exists account_id uuid references public.avito_report_accounts(id) on delete cascade,
  add column if not exists report_type text default 'daily',
  add column if not exists period_type text default 'daily',
  add column if not exists period_start date,
  add column if not exists period_end date,
  add column if not exists views integer default 0,
  add column if not exists contacts integer default 0,
  add column if not exists favorites integer default 0,
  add column if not exists expenses numeric default 0,
  add column if not exists conversion numeric default 0,
  add column if not exists cost_per_contact numeric default 0,
  add column if not exists stats_status text default 'pending',
  add column if not exists expenses_status text default 'pending',
  add column if not exists quality_status text default 'pending',
  add column if not exists warnings text[] default '{}',
  add column if not exists attempts integer default 0,
  add column if not exists last_error text,
  add column if not exists raw jsonb default '{}'::jsonb,
  add column if not exists fetched_at timestamptz,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

update public.avito_report_snapshots
set
  report_type = coalesce(report_type, 'daily'),
  period_type = coalesce(period_type, report_type, 'daily'),
  views = coalesce(views, 0),
  contacts = coalesce(contacts, 0),
  favorites = coalesce(favorites, 0),
  expenses = coalesce(expenses, 0),
  conversion = coalesce(conversion, 0),
  cost_per_contact = coalesce(cost_per_contact, 0),
  stats_status = coalesce(stats_status, 'pending'),
  expenses_status = coalesce(expenses_status, 'pending'),
  quality_status = coalesce(quality_status, 'pending'),
  warnings = coalesce(warnings, '{}'),
  attempts = coalesce(attempts, 0),
  raw = coalesce(raw, '{}'::jsonb),
  created_at = coalesce(created_at, now()),
  updated_at = coalesce(updated_at, now());

create unique index if not exists avito_report_snapshots_account_period_uidx
  on public.avito_report_snapshots (account_id, report_type, period_start, period_end)
  where account_id is not null and report_type is not null and period_start is not null and period_end is not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'avito_report_snapshots_account_period_key'
      and conrelid = 'public.avito_report_snapshots'::regclass
  ) then
    alter table public.avito_report_snapshots
      add constraint avito_report_snapshots_account_period_key
      unique (account_id, report_type, period_start, period_end);
  end if;
end $$;

create index if not exists avito_report_snapshots_client_period_idx
  on public.avito_report_snapshots (client_id, report_type, period_start, period_end);

create index if not exists avito_report_snapshots_quality_idx
  on public.avito_report_snapshots (quality_status, stats_status, expenses_status);

create table if not exists public.avito_report_sync_jobs (
  id uuid primary key default gen_random_uuid()
);

alter table public.avito_report_sync_jobs
  add column if not exists client_id uuid references public.avito_report_clients(id) on delete cascade,
  add column if not exists account_id uuid references public.avito_report_accounts(id) on delete cascade,
  add column if not exists report_type text default 'daily',
  add column if not exists period_start date,
  add column if not exists period_end date,
  add column if not exists status text default 'pending',
  add column if not exists priority integer default 100,
  add column if not exists attempts integer default 0,
  add column if not exists next_run_at timestamptz default now(),
  add column if not exists locked_at timestamptz,
  add column if not exists last_error text,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

update public.avito_report_sync_jobs
set
  report_type = coalesce(report_type, 'daily'),
  status = coalesce(status, 'pending'),
  priority = coalesce(priority, 100),
  attempts = coalesce(attempts, 0),
  next_run_at = coalesce(next_run_at, now()),
  created_at = coalesce(created_at, now()),
  updated_at = coalesce(updated_at, now());

create unique index if not exists avito_report_sync_jobs_account_period_uidx
  on public.avito_report_sync_jobs (account_id, report_type, period_start, period_end)
  where account_id is not null and report_type is not null and period_start is not null and period_end is not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'avito_report_sync_jobs_account_period_key'
      and conrelid = 'public.avito_report_sync_jobs'::regclass
  ) then
    alter table public.avito_report_sync_jobs
      add constraint avito_report_sync_jobs_account_period_key
      unique (account_id, report_type, period_start, period_end);
  end if;
end $$;

create index if not exists avito_report_sync_jobs_due_idx
  on public.avito_report_sync_jobs (status, next_run_at, priority);

create index if not exists avito_report_sync_jobs_client_idx
  on public.avito_report_sync_jobs (client_id, report_type, period_start, period_end);

alter table public.avito_report_snapshots enable row level security;
alter table public.avito_report_sync_jobs enable row level security;

drop policy if exists "service role manages avito report snapshots" on public.avito_report_snapshots;
create policy "service role manages avito report snapshots"
  on public.avito_report_snapshots
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "service role manages avito report sync jobs" on public.avito_report_sync_jobs;
create policy "service role manages avito report sync jobs"
  on public.avito_report_sync_jobs
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
