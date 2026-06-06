-- Character portrait uploads (Supabase Storage)

create or replace function public.can_view_character(p_character_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
	select exists (
		select 1
		from public.characters c
		where c.id = p_character_id
			and (
				c.owner_id = auth.uid()
				or (c.campaign_id is not null and public.is_campaign_member(c.campaign_id))
			)
	);
$$;

create or replace function public.can_edit_character(p_character_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
	select exists (
		select 1
		from public.characters c
		where c.id = p_character_id
			and (
				c.owner_id = auth.uid()
				or (c.campaign_id is not null and public.is_campaign_gm(c.campaign_id))
			)
	);
$$;

grant execute on function public.can_view_character(uuid) to authenticated;
grant execute on function public.can_edit_character(uuid) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
	'character-portraits',
	'character-portraits',
	true,
	5242880,
	array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
	public = excluded.public,
	file_size_limit = excluded.file_size_limit,
	allowed_mime_types = excluded.allowed_mime_types;

create policy "Character portraits are viewable by campaign"
on storage.objects for select
using (
	bucket_id = 'character-portraits'
	and public.can_view_character(((storage.foldername(name))[1])::uuid)
);

create policy "Editors can upload character portraits"
on storage.objects for insert
with check (
	bucket_id = 'character-portraits'
	and public.can_edit_character(((storage.foldername(name))[1])::uuid)
);

create policy "Editors can update character portraits"
on storage.objects for update
using (
	bucket_id = 'character-portraits'
	and public.can_edit_character(((storage.foldername(name))[1])::uuid)
);

create policy "Editors can delete character portraits"
on storage.objects for delete
using (
	bucket_id = 'character-portraits'
	and public.can_edit_character(((storage.foldername(name))[1])::uuid)
);
