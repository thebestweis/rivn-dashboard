alter table public.payments
  add column if not exists is_recurring boolean not null default false;

create index if not exists payments_workspace_recurring_idx
  on public.payments (workspace_id, is_recurring)
  where is_recurring = true;
