-- RIVN OS user profiles.
-- Run this once in Supabase SQL Editor before using Settings -> Profile.

alter table public.workspace_members
  add column if not exists avatar_url text,
  add column if not exists profile_title text,
  add column if not exists profile_description text,
  add column if not exists phone text,
  add column if not exists telegram text;
