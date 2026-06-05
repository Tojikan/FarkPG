-- Unassigned characters: campaign delete sets campaign_id null instead of deleting characters

alter table public.characters drop constraint if exists characters_campaign_id_fkey;

alter table public.characters alter column campaign_id drop not null;

alter table public.characters
	add constraint characters_campaign_id_fkey
	foreign key (campaign_id) references public.campaigns (id) on delete set null;

drop policy if exists "Members can view characters" on public.characters;
drop policy if exists "Members can create own characters" on public.characters;
drop policy if exists "Owners and GMs can update characters" on public.characters;
drop policy if exists "Owners and GMs can delete characters" on public.characters;

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
