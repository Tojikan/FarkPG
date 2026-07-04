-- RPG Character App: fresh schema.
-- GMs authenticate with Supabase Auth (accounts created manually in the dashboard).
-- Players never log in: every player read/write goes through the SECURITY DEFINER
-- RPC functions at the bottom, which validate campaign_code + character_code.
-- The anon role has NO direct access to the tables.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.campaigns (
	id uuid primary key default gen_random_uuid(),
	gm_id uuid not null references auth.users (id) on delete cascade,
	name text not null,
	setting_id text not null,
	campaign_code text not null unique,
	max_characters integer not null default 6 check (max_characters between 1 and 50),
	config_overrides jsonb not null default '{}'::jsonb,
	notes text not null default '',
	created_at timestamptz not null default now()
);

create table public.characters (
	id uuid primary key default gen_random_uuid(),
	campaign_id uuid not null references public.campaigns (id) on delete cascade,
	name text not null default '',
	player_name text not null default '',
	image_path text,
	character_code text not null unique,
	data jsonb not null default '{}'::jsonb,
	deleted_at timestamptz,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

create index characters_campaign_idx on public.characters (campaign_id);

create table public.items (
	id uuid primary key default gen_random_uuid(),
	campaign_id uuid not null references public.campaigns (id) on delete cascade,
	name text not null,
	description text not null default '',
	data jsonb not null default '{}'::jsonb,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

create index items_campaign_idx on public.items (campaign_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
	new.updated_at = now();
	return new;
end;
$$;

create trigger characters_updated_at
before update on public.characters
for each row execute function public.set_updated_at();

create trigger items_updated_at
before update on public.items
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security: GM-only. No policies for anon (RPCs are the only path).
-- ---------------------------------------------------------------------------

alter table public.campaigns enable row level security;
alter table public.characters enable row level security;
alter table public.items enable row level security;

create policy "GM full access to own campaigns"
on public.campaigns for all
to authenticated
using (gm_id = auth.uid())
with check (gm_id = auth.uid());

create policy "GM full access to campaign characters"
on public.characters for all
to authenticated
using (exists (
	select 1 from public.campaigns c
	where c.id = campaign_id and c.gm_id = auth.uid()
))
with check (exists (
	select 1 from public.campaigns c
	where c.id = campaign_id and c.gm_id = auth.uid()
));

create policy "GM full access to campaign items"
on public.items for all
to authenticated
using (exists (
	select 1 from public.campaigns c
	where c.id = campaign_id and c.gm_id = auth.uid()
))
with check (exists (
	select 1 from public.campaigns c
	where c.id = campaign_id and c.gm_id = auth.uid()
));

-- ---------------------------------------------------------------------------
-- Code generation (unambiguous alphabet: no 0/O/1/I/L)
-- ---------------------------------------------------------------------------

create or replace function public.generate_code(p_length integer)
returns text
language plpgsql
volatile
as $$
declare
	v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
	v_code text := '';
	i integer;
begin
	for i in 1..p_length loop
		v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::integer, 1);
	end loop;
	return v_code;
end;
$$;

-- Called by the GM app when creating a campaign.
create or replace function public.create_campaign(
	p_name text,
	p_setting_id text,
	p_max_characters integer
)
returns public.campaigns
language plpgsql
security definer
set search_path = public
as $$
declare
	v_row public.campaigns;
	v_code text;
begin
	if auth.uid() is null then
		raise exception 'Not authenticated';
	end if;
	if coalesce(trim(p_name), '') = '' then
		raise exception 'Campaign name is required';
	end if;

	loop
		v_code := public.generate_code(6);
		exit when not exists (select 1 from public.campaigns where campaign_code = v_code);
	end loop;

	insert into public.campaigns (gm_id, name, setting_id, campaign_code, max_characters)
	values (auth.uid(), trim(p_name), p_setting_id, v_code, coalesce(p_max_characters, 6))
	returning * into v_row;

	return v_row;
end;
$$;

grant execute on function public.create_campaign(text, text, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Player RPCs (anon). Every function validates codes on every call.
-- ---------------------------------------------------------------------------

-- Internal: resolve a campaign by code or raise.
create or replace function public.resolve_campaign(p_campaign_code text)
returns public.campaigns
language plpgsql
stable
security definer
set search_path = public
as $$
declare
	v_row public.campaigns;
begin
	select * into v_row
	from public.campaigns
	where campaign_code = upper(trim(p_campaign_code));

	if v_row.id is null then
		raise exception 'Unknown campaign code';
	end if;
	return v_row;
end;
$$;

-- Internal: resolve a live character by codes or raise.
create or replace function public.resolve_character(p_campaign_code text, p_character_code text)
returns public.characters
language plpgsql
stable
security definer
set search_path = public
as $$
declare
	v_campaign public.campaigns;
	v_row public.characters;
begin
	v_campaign := public.resolve_campaign(p_campaign_code);

	select * into v_row
	from public.characters
	where campaign_id = v_campaign.id
		and character_code = upper(trim(p_character_code))
		and deleted_at is null;

	if v_row.id is null then
		raise exception 'Unknown character code';
	end if;
	return v_row;
end;
$$;

-- /join: campaign name, setting, and whether a slot is free.
create or replace function public.join_campaign(p_campaign_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
	v_campaign public.campaigns;
	v_used integer;
begin
	v_campaign := public.resolve_campaign(p_campaign_code);

	select count(*) into v_used
	from public.characters
	where campaign_id = v_campaign.id and deleted_at is null;

	return jsonb_build_object(
		'campaign_code', v_campaign.campaign_code,
		'name', v_campaign.name,
		'setting_id', v_campaign.setting_id,
		'config_overrides', v_campaign.config_overrides,
		'max_characters', v_campaign.max_characters,
		'used_slots', v_used,
		'slots_available', v_used < v_campaign.max_characters
	);
end;
$$;

-- Wizard finish: create the character if a slot is free. Returns codes + id.
create or replace function public.create_character(
	p_campaign_code text,
	p_name text,
	p_player_name text,
	p_image_path text,
	p_data jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
	v_campaign public.campaigns;
	v_used integer;
	v_code text;
	v_row public.characters;
begin
	v_campaign := public.resolve_campaign(p_campaign_code);

	if coalesce(trim(p_name), '') = '' then
		raise exception 'Character name is required';
	end if;

	-- Lock the campaign row so concurrent joins can't exceed the slot count.
	perform 1 from public.campaigns where id = v_campaign.id for update;

	select count(*) into v_used
	from public.characters
	where campaign_id = v_campaign.id and deleted_at is null;

	if v_used >= v_campaign.max_characters then
		raise exception 'Campaign is full';
	end if;

	loop
		v_code := public.generate_code(8);
		exit when not exists (select 1 from public.characters where character_code = v_code);
	end loop;

	insert into public.characters (campaign_id, name, player_name, image_path, character_code, data)
	values (v_campaign.id, trim(p_name), coalesce(trim(p_player_name), ''), p_image_path, v_code, coalesce(p_data, '{}'::jsonb))
	returning * into v_row;

	return jsonb_build_object(
		'id', v_row.id,
		'character_code', v_row.character_code,
		'campaign_code', v_campaign.campaign_code
	);
end;
$$;

-- Sheet load: character + campaign context in one round trip.
create or replace function public.load_character(p_campaign_code text, p_character_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
	v_char public.characters;
	v_campaign public.campaigns;
begin
	v_char := public.resolve_character(p_campaign_code, p_character_code);
	select * into v_campaign from public.campaigns where id = v_char.campaign_id;

	return jsonb_build_object(
		'id', v_char.id,
		'name', v_char.name,
		'player_name', v_char.player_name,
		'image_path', v_char.image_path,
		'data', v_char.data,
		'updated_at', v_char.updated_at,
		'campaign', jsonb_build_object(
			'name', v_campaign.name,
			'setting_id', v_campaign.setting_id,
			'config_overrides', v_campaign.config_overrides
		)
	);
end;
$$;

-- Sheet autosave. Only the fields a player may touch.
create or replace function public.save_character(
	p_campaign_code text,
	p_character_code text,
	p_name text,
	p_player_name text,
	p_image_path text,
	p_data jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
	v_char public.characters;
begin
	v_char := public.resolve_character(p_campaign_code, p_character_code);

	update public.characters
	set
		name = coalesce(nullif(trim(p_name), ''), name),
		player_name = coalesce(p_player_name, player_name),
		image_path = coalesce(p_image_path, image_path),
		data = coalesce(p_data, data)
	where id = v_char.id;

	return jsonb_build_object('ok', true, 'saved_at', now());
end;
$$;

-- Item quick-add on the player sheet needs the campaign item list.
create or replace function public.list_campaign_items(p_campaign_code text, p_character_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
	v_char public.characters;
begin
	-- Requires a valid character, not just a campaign code.
	v_char := public.resolve_character(p_campaign_code, p_character_code);

	return coalesce(
		(
			select jsonb_agg(jsonb_build_object(
				'id', i.id,
				'name', i.name,
				'description', i.description,
				'data', i.data
			) order by i.name)
			from public.items i
			where i.campaign_id = v_char.campaign_id
		),
		'[]'::jsonb
	);
end;
$$;

grant execute on function public.join_campaign(text) to anon, authenticated;
grant execute on function public.create_character(text, text, text, text, jsonb) to anon, authenticated;
grant execute on function public.load_character(text, text) to anon, authenticated;
grant execute on function public.save_character(text, text, text, text, text, jsonb) to anon, authenticated;
grant execute on function public.list_campaign_items(text, text) to anon, authenticated;

-- Internal helpers are not callable directly. Functions get EXECUTE granted
-- to PUBLIC by default, so that grant must be revoked too.
revoke execute on function public.resolve_campaign(text) from public, anon, authenticated;
revoke execute on function public.resolve_character(text, text) from public, anon, authenticated;
revoke execute on function public.generate_code(integer) from public, anon, authenticated;
revoke execute on function public.create_campaign(text, text, integer) from public, anon;

-- ---------------------------------------------------------------------------
-- Storage: character images (public read, size-limited uploads)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
	'character-images',
	'character-images',
	true,
	3145728, -- 3 MB
	array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
	public = excluded.public,
	file_size_limit = excluded.file_size_limit,
	allowed_mime_types = excluded.allowed_mime_types;

create policy "Anyone can view character images"
on storage.objects for select
using (bucket_id = 'character-images');

create policy "Anyone can upload character images"
on storage.objects for insert
to anon, authenticated
with check (bucket_id = 'character-images');

create policy "Anyone can replace character images"
on storage.objects for update
to anon, authenticated
using (bucket_id = 'character-images');
