create table if not exists public.avito_telegram_delivery_queue (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null,
  telegram_chat_id text not null,
  report_type text not null,
  period_start date not null,
  period_end date not null,
  message text not null,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'sent', 'failed')),
  attempts integer not null default 0,
  last_error text,
  telegram_message_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz
);

create index if not exists avito_telegram_delivery_queue_status_created_idx
  on public.avito_telegram_delivery_queue (status, created_at);

create index if not exists avito_telegram_delivery_queue_client_period_idx
  on public.avito_telegram_delivery_queue (client_id, report_type, period_start, period_end);
