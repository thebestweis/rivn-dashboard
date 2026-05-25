-- Индексы для быстрых фильтров и сортировки счетов в разделе /payments.
-- Запускать в Supabase SQL Editor. Скрипт безопасен для повторного запуска.

create index if not exists payments_workspace_due_date_idx
  on public.payments (workspace_id, due_date desc);

create index if not exists payments_workspace_paid_date_idx
  on public.payments (workspace_id, paid_date desc)
  where status = 'paid';

create index if not exists payments_workspace_status_due_date_idx
  on public.payments (workspace_id, status, due_date desc);

create index if not exists payments_workspace_status_paid_date_idx
  on public.payments (workspace_id, status, paid_date desc);

create index if not exists payments_workspace_amount_idx
  on public.payments (workspace_id, amount desc);
