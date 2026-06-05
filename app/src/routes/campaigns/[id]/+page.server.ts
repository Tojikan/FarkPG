import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const user = locals.user;
	if (!user) error(401, 'Unauthorized');

	const { data: membership, error: memberError } = await locals.supabase
		.from('campaign_members')
		.select('role')
		.eq('campaign_id', params.id)
		.eq('user_id', user.id)
		.maybeSingle();

	if (memberError || !membership) error(404, 'Campaign not found');

	const { data: campaign, error: campaignError } = await locals.supabase
		.from('campaigns')
		.select('id, name, invite_code, created_at')
		.eq('id', params.id)
		.single();

	if (campaignError || !campaign) error(404, 'Campaign not found');

	const { data: members } = await locals.supabase
		.from('campaign_members')
		.select('role, profiles(display_name)')
		.eq('campaign_id', params.id);

	return {
		campaign,
		isGm: membership.role === 'gm',
		members:
			members?.map((m) => {
				const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
				return {
					role: m.role as 'gm' | 'player',
					display_name: profile?.display_name ?? null
				};
			}) ?? []
	};
};

export const actions: Actions = {
	delete: async ({ locals, params }) => {
		const user = locals.user;
		if (!user) return fail(401, { error: 'Not authenticated.' });

		const { data: membership } = await locals.supabase
			.from('campaign_members')
			.select('role')
			.eq('campaign_id', params.id)
			.eq('user_id', user.id)
			.maybeSingle();

		if (!membership || membership.role !== 'gm') {
			return fail(403, { error: 'Only GMs can delete campaigns.' });
		}

		const { error: deleteError } = await locals.supabase
			.from('campaigns')
			.delete()
			.eq('id', params.id);

		if (deleteError) return fail(400, { error: deleteError.message });
		redirect(303, '/campaigns');
	}
};
