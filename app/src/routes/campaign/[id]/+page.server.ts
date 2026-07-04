import { error, fail } from '@sveltejs/kit';
import { getSetting } from '$lib/settings';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const { data: campaign } = await locals.supabase
		.from('campaigns')
		.select('*')
		.eq('id', params.id)
		.single();

	if (!campaign) error(404, 'Campaign not found');

	const { data: characters } = await locals.supabase
		.from('characters')
		.select('id, name, player_name, image_path, character_code, data, created_at')
		.eq('campaign_id', params.id)
		.is('deleted_at', null)
		.order('created_at');

	let setting;
	try {
		setting = getSetting(campaign.setting_id);
	} catch {
		error(500, `Campaign uses unknown setting "${campaign.setting_id}"`);
	}

	return { campaign, characters: characters ?? [], setting };
};

export const actions: Actions = {
	updateCampaign: async ({ request, locals, params }) => {
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		const maxCharacters = Number(form.get('max_characters') ?? 0);
		const notes = String(form.get('notes') ?? '');

		if (!name) return fail(400, { message: 'Campaign name is required.' });
		if (!Number.isInteger(maxCharacters) || maxCharacters < 1 || maxCharacters > 50) {
			return fail(400, { message: 'Player slots must be between 1 and 50.' });
		}

		const { error: err } = await locals.supabase
			.from('campaigns')
			.update({ name, max_characters: maxCharacters, notes })
			.eq('id', params.id);

		if (err) return fail(500, { message: 'Could not save campaign settings.' });
		return { success: true };
	},

	deleteCharacter: async ({ request, locals, params }) => {
		const form = await request.formData();
		const characterId = String(form.get('character_id') ?? '');

		const { error: err } = await locals.supabase
			.from('characters')
			.update({ deleted_at: new Date().toISOString() })
			.eq('id', characterId)
			.eq('campaign_id', params.id);

		if (err) return fail(500, { message: 'Could not remove the character.' });
		return { success: true };
	}
};
