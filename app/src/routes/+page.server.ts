import { fail } from '@sveltejs/kit';
import { settingsList } from '$lib/settings';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const { data: campaigns, error } = await locals.supabase
		.from('campaigns')
		.select('id, name, setting_id, campaign_code, max_characters, created_at, characters(count)')
		.is('characters.deleted_at', null)
		.order('created_at', { ascending: false });

	if (error) console.error('load campaigns failed', error);

	return {
		campaigns: (campaigns ?? []).map((c) => ({
			...c,
			characterCount: (c.characters as unknown as { count: number }[])[0]?.count ?? 0
		})),
		settings: settingsList.map((s) => ({ id: s.id, name: s.name, tagline: s.tagline }))
	};
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		const settingId = String(form.get('setting_id') ?? '');
		const maxCharacters = Number(form.get('max_characters') ?? 6);

		if (!name) return fail(400, { message: 'Campaign name is required.' });
		if (!settingsList.some((s) => s.id === settingId)) {
			return fail(400, { message: 'Pick a setting.' });
		}
		if (!Number.isInteger(maxCharacters) || maxCharacters < 1 || maxCharacters > 50) {
			return fail(400, { message: 'Player slots must be between 1 and 50.' });
		}

		const { error } = await locals.supabase.rpc('create_campaign', {
			p_name: name,
			p_setting_id: settingId,
			p_max_characters: maxCharacters
		});

		if (error) {
			console.error('create_campaign failed', error);
			return fail(500, { message: 'Could not create the campaign.' });
		}
		return { success: true };
	}
};
