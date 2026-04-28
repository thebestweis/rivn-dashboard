insert into storage.buckets (id, name, public, file_size_limit)
values ('chat-attachments', 'chat-attachments', false, 10485760)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit;

alter table public.crm_deal_comments
  add column if not exists file_name text,
  add column if not exists file_type text,
  add column if not exists file_size bigint,
  add column if not exists storage_path text;

create index if not exists crm_deal_comments_storage_path_idx
on public.crm_deal_comments (workspace_id, storage_path)
where storage_path is not null;

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
