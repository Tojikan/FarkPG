-- ⚠️  DESTRUCTIVE: drops the OLD FarkPG schema (pre-rebuild).
-- Run this ONCE against an existing Supabase project that has the old
-- profiles/campaign_members schema, BEFORE running 001_initial.sql.
-- Skip it entirely on a fresh project.

-- Old auth trigger
drop trigger if exists on_auth_user_created on auth.users;

-- Old storage policies + bucket
drop policy if exists "Character portraits are viewable by campaign" on storage.objects;
drop policy if exists "Editors can upload character portraits" on storage.objects;
drop policy if exists "Editors can update character portraits" on storage.objects;
drop policy if exists "Editors can delete character portraits" on storage.objects;
delete from storage.objects where bucket_id = 'character-portraits';
delete from storage.buckets where id = 'character-portraits';

-- Old functions
drop function if exists public.handle_new_user();
drop function if exists public.set_updated_at() cascade;
drop function if exists public.is_campaign_member(uuid);
drop function if exists public.is_campaign_gm(uuid);
drop function if exists public.create_campaign(text, text);
drop function if exists public.join_campaign(text);
drop function if exists public.can_view_character(uuid);
drop function if exists public.can_edit_character(uuid);

-- Old tables
drop table if exists public.items cascade;
drop table if exists public.characters cascade;
drop table if exists public.campaign_members cascade;
drop table if exists public.campaigns cascade;
drop table if exists public.profiles cascade;

-- Old types
drop type if exists public.campaign_role;
