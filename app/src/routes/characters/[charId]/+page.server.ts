import { error, fail, redirect } from '@sveltejs/kit';
import { getTheme } from '$lib/data/themes';
import { canEditCharacter } from '$lib/server/characterAccess';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const user = locals.user;
	if (!user) error(401, 'Unauthorized');

	const { data: character, error: charError } = await locals.supabase
		.from('characters')
		.select('id, name, theme_id, owner_id, campaign_id, data')
		.eq('id', params.charId)
		.single();

	if (charError || !character) error(404, 'Character not found');

	const canEdit = await canEditCharacter(locals.supabase, user.id, character);

	const theme = getTheme(character.theme_id);
	if (!theme) error(500, 'Unknown theme');

	let campaignName: string | null = null;
	if (character.campaign_id) {
		const { data: campaign } = await locals.supabase
			.from('campaigns')
			.select('name')
			.eq('id', character.campaign_id)
			.single();
		campaignName = campaign?.name ?? null;
	}

	return {
		character,
		theme,
		canEdit,
		campaignId: character.campaign_id,
		campaignName
	};
};

export const actions: Actions = {
	delete: async ({ locals, params }) => {
		const user = locals.user;
		if (!user) return fail(401, { error: 'Not authenticated.' });

		const { data: character } = await locals.supabase
			.from('characters')
			.select('owner_id, campaign_id')
			.eq('id', params.charId)
			.single();

		if (!character) return fail(404, { error: 'Character not found.' });
		if (!(await canEditCharacter(locals.supabase, user.id, character))) {
			return fail(403, { error: 'Not allowed.' });
		}

		const { error: deleteError } = await locals.supabase
			.from('characters')
			.delete()
			.eq('id', params.charId);

		if (deleteError) return fail(400, { error: deleteError.message });

		if (character.campaign_id) {
			redirect(303, `/campaigns/${character.campaign_id}/characters`);
		}
		redirect(303, '/campaigns');
	}
};
