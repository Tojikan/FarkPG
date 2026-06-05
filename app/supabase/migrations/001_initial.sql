-- FarkPG Sheets: initial schema + RLS

create extension if not exists "pgcrypto";

create type campaign_role as enum ('gm', 'player');

-- Profiles (extends auth.users)
create table public.profiles (
	id uuid primary key references auth.users (id) on delete cascade,
	display_name text,
	created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
	insert into public.profiles (id, display_name)
	values (
		new.id,
		coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
	);
	return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

-- Campaigns
create table public.campaigns (
	id uuid primary key default gen_random_uuid(),
	name text not null,
	invite_code text not null unique,
	created_by uuid not null references public.profiles (id),
	created_at timestamptz not null default now()
);

create table public.campaign_members (
	campaign_id uuid not null references public.campaigns (id) on delete cascade,
	user_id uuid not null references public.profiles (id) on delete cascade,
	role campaign_role not null default 'player',
	joined_at timestamptz not null default now(),
	primary key (campaign_id, user_id)
);

create table public.characters (
	id uuid primary key default gen_random_uuid(),
	campaign_id uuid references public.campaigns (id) on delete set null,
	owner_id uuid not null references public.profiles (id),
	theme_id text not null,
	name text not null default '',
	data jsonb not null default '{}'::jsonb,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

create table public.items (
	id uuid primary key default gen_random_uuid(),
	campaign_id uuid not null references public.campaigns (id) on delete cascade,
	name text not null,
	data jsonb not null default '{}'::jsonb,
	created_by uuid not null references public.profiles (id),
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

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
for each row
execute function public.set_updated_at();

create trigger items_updated_at
before update on public.items
for each row
execute function public.set_updated_at();

-- Access helpers
create or replace function public.is_campaign_member(p_campaign_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
	select exists (
		select 1
		from public.campaign_members
		where campaign_id = p_campaign_id
			and user_id = auth.uid()
	);
$$;

create or replace function public.is_campaign_gm(p_campaign_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
	select exists (
		select 1
		from public.campaign_members
		where campaign_id = p_campaign_id
			and user_id = auth.uid()
			and role = 'gm'
	);
$$;

create or replace function public.create_campaign(p_name text, p_invite_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
	v_id uuid;
begin
	if auth.uid() is null then
		raise exception 'Not authenticated';
	end if;

	insert into public.campaigns (name, invite_code, created_by)
	values (p_name, p_invite_code, auth.uid())
	returning id into v_id;

	insert into public.campaign_members (campaign_id, user_id, role)
	values (v_id, auth.uid(), 'gm');

	return v_id;
end;
$$;

create or replace function public.join_campaign(p_invite_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
	v_campaign_id uuid;
begin
	if auth.uid() is null then
		raise exception 'Not authenticated';
	end if;

	select id into v_campaign_id
	from public.campaigns
	where invite_code = lower(trim(p_invite_code));

	if v_campaign_id is null then
		raise exception 'Invalid invite code';
	end if;

	insert into public.campaign_members (campaign_id, user_id, role)
	values (v_campaign_id, auth.uid(), 'player')
	on conflict do nothing;

	return v_campaign_id;
end;
$$;

grant execute on function public.create_campaign(text, text) to authenticated;
grant execute on function public.join_campaign(text) to authenticated;

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_members enable row level security;
alter table public.characters enable row level security;
alter table public.items enable row level security;

create policy "Users can view own profile"
on public.profiles for select
using (auth.uid() = id);

create policy "Users can update own profile"
on public.profiles for update
using (auth.uid() = id);

create policy "Members can view campaigns"
on public.campaigns for select
using (public.is_campaign_member(id));

create policy "GMs can delete campaigns"
on public.campaigns for delete
using (public.is_campaign_gm(id));

create policy "Members can view campaign members"
on public.campaign_members for select
using (public.is_campaign_member(campaign_id));

create policy "Users can view accessible characters"
on public.characters for select
using (
	auth.uid() = owner_id
	or (campaign_id is not null and public.is_campaign_member(campaign_id))
);

create policy "Users can create own characters"
on public.characters for insert
with check (
	auth.uid() = owner_id
	and (campaign_id is null or public.is_campaign_member(campaign_id))
);

create policy "Owners and GMs can update characters"
on public.characters for update
using (
	auth.uid() = owner_id
	or (campaign_id is not null and public.is_campaign_gm(campaign_id))
);

create policy "Owners and GMs can delete characters"
on public.characters for delete
using (
	auth.uid() = owner_id
	or (campaign_id is not null and public.is_campaign_gm(campaign_id))
);

create policy "Members can view items"
on public.items for select
using (public.is_campaign_member(campaign_id));

create policy "GMs can insert items"
on public.items for insert
with check (public.is_campaign_gm(campaign_id) and auth.uid() = created_by);

create policy "GMs can update items"
on public.items for update
using (public.is_campaign_gm(campaign_id));

create policy "GMs can delete items"
on public.items for delete
using (public.is_campaign_gm(campaign_id));
