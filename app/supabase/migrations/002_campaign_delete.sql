-- Allow GMs to delete their campaigns (cascades to members, characters, items)

create policy "GMs can delete campaigns"
on public.campaigns for delete
using (public.is_campaign_gm(id));
