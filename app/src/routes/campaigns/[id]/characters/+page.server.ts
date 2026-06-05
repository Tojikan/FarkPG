import { error, fail, redirect } from '@sveltejs/kit';
import { createEmptyCharacterData } from '$lib/data/character';
import { getTheme } from '$lib/data/themes';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const user = locals.user;
	if (!user) error(401, 'Unauthorized');

	const { data: membership } = await locals.supabase
		.from('campaign_members')
		.select('role')
		.eq('campaign_id', params.id)
		.eq('user_id', user.id)
		.maybeSingle();

	if (!membership) error(404, 'Campaign not found');

	const { data: campaign } = await locals.supabase
		.from('campaigns')
		.select('id, name')
		.eq('id', params.id)
		.single();

	if (!campaign) error(404, 'Campaign not found');

	let query = locals.supabase
		.from('characters')
		.select('id, name, theme_id, owner_id, updated_at, profiles(display_name)')
		.eq('campaign_id', params.id)
		.order('updated_at', { ascending: false });

	if (membership.role !== 'gm') {
		query = query.eq('owner_id', user.id);
	}

	const { data: characters, error: charError } = await query;
	if (charError) error(500, charError.message);

	return {
		campaignId: campaign.id,
		campaignName: campaign.name,
		isGm: membership.role === 'gm',
		characters:
			characters?.map((c) => {
				const profile = Array.isArray(c.profiles) ? c.profiles[0] : c.profiles;
				return {
					id: c.id,
					name: c.name,
					theme_id: c.theme_id,
					owner_name: profile?.display_name ?? null
				};
			}) ?? []
	};
};

export const actions: Actions = {
	create: async ({ request, locals, params }) => {
		const user = locals.user;
		if (!user) return fail(401, { error: 'Not authenticated.' });

		const formData = await request.formData();
		const name = String(formData.get('name') ?? '').trim();
		const themeId = String(formData.get('themeId') ?? 'basic');

		const theme = getTheme(themeId);
		if (!theme) return fail(400, { error: 'Invalid theme.' });
		if (!name) return fail(400, { error: 'Name is required.' });

		const { data, error: insertError } = await locals.supabase
			.from('characters')
			.insert({
				campaign_id: params.id,
				owner_id: user.id,
				theme_id: themeId,
				name,
				data: createEmptyCharacterData(theme)
			})
			.select('id')
			.single();

		if (insertError) return fail(400, { error: insertError.message });
		redirect(303, `/characters/${data.id}`);
	}
};
