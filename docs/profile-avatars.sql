insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-avatars',
  'profile-avatars',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "profile_avatars_public_read" on storage.objects;
create policy "profile_avatars_public_read"
on storage.objects
for select
using (bucket_id = 'profile-avatars');

drop policy if exists "profile_avatars_insert_own_member_folder" on storage.objects;
create policy "profile_avatars_insert_own_member_folder"
on storage.objects
for insert
with check (
  bucket_id = 'profile-avatars'
  and exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id::text = (storage.foldername(name))[1]
      and wm.id::text = (storage.foldername(name))[2]
      and wm.user_id = auth.uid()
      and wm.status = 'active'
  )
);

drop policy if exists "profile_avatars_update_own_member_folder" on storage.objects;
create policy "profile_avatars_update_own_member_folder"
on storage.objects
for update
using (
  bucket_id = 'profile-avatars'
  and exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id::text = (storage.foldername(name))[1]
      and wm.id::text = (storage.foldername(name))[2]
      and wm.user_id = auth.uid()
      and wm.status = 'active'
  )
)
with check (
  bucket_id = 'profile-avatars'
  and exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id::text = (storage.foldername(name))[1]
      and wm.id::text = (storage.foldername(name))[2]
      and wm.user_id = auth.uid()
      and wm.status = 'active'
  )
);

drop policy if exists "profile_avatars_delete_own_member_folder" on storage.objects;
create policy "profile_avatars_delete_own_member_folder"
on storage.objects
for delete
using (
  bucket_id = 'profile-avatars'
  and exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id::text = (storage.foldername(name))[1]
      and wm.id::text = (storage.foldername(name))[2]
      and wm.user_id = auth.uid()
      and wm.status = 'active'
  )
);
