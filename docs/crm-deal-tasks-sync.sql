alter table public.crm_deal_tasks
  add column if not exists task_id uuid references public.tasks(id) on delete set null;

create index if not exists crm_deal_tasks_task_id_idx
  on public.crm_deal_tasks(task_id);
