alter table public.crm_assignment_rules
add column if not exists settings jsonb not null default '{}'::jsonb;

