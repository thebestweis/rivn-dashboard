insert into storage.buckets (id, name, public, file_size_limit)
values ('chat-attachments', 'chat-attachments', false, 10485760)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit;

create table if not exists public.chat_attachments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  task_comment_id uuid references public.task_comments(id) on delete cascade,
  project_comment_id uuid references public.project_comments(id) on delete cascade,
  bucket_id text not null default 'chat-attachments',
  storage_path text not null,
  file_name text not null,
  file_type text,
  file_size bigint,
  created_at timestamptz not null default now(),
  constraint chat_attachments_single_parent check (
    (task_comment_id is not null and project_comment_id is null)
    or
    (task_comment_id is null and project_comment_id is not null)
  )
);

create index if not exists chat_attachments_workspace_task_comment_idx
on public.chat_attachments (workspace_id, task_comment_id, created_at);

create index if not exists chat_attachments_workspace_project_comment_idx
on public.chat_attachments (workspace_id, project_comment_id, created_at);

alter table public.chat_attachments enable row level security;

drop policy if exists "chat_attachments_select_workspace_members"
on public.chat_attachments;

create policy "chat_attachments_select_workspace_members"
on public.chat_attachments
for select
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = chat_attachments.workspace_id
      and wm.user_id = auth.uid()
      and wm.status = 'active'
  )
);

drop policy if exists "chat_attachments_insert_workspace_members"
on public.chat_attachments;

create policy "chat_attachments_insert_workspace_members"
on public.chat_attachments
for insert
with check (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = chat_attachments.workspace_id
      and wm.user_id = auth.uid()
      and wm.status = 'active'
  )
);

drop policy if exists "chat_attachment_objects_select_workspace_members"
on storage.objects;

create policy "chat_attachment_objects_select_workspace_members"
on storage.objects
for select
using (
  bucket_id = 'chat-attachments'
  and exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id::text = (storage.foldername(name))[1]
      and wm.user_id = auth.uid()
      and wm.status = 'active'
  )
);

drop policy if exists "chat_attachment_objects_insert_workspace_members"
on storage.objects;

create policy "chat_attachment_objects_insert_workspace_members"
on storage.objects
for insert
with check (
  bucket_id = 'chat-attachments'
  and exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id::text = (storage.foldername(name))[1]
      and wm.user_id = auth.uid()
      and wm.status = 'active'
  )
);
