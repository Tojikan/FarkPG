import { error } from '@sveltejs/kit';
import { getSetting } from '$lib/settings';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const { data: campaign } = await locals.supabase
		.from('campaigns')
		.select('id, name, setting_id')
		.eq('id', params.id)
		.single();
	if (!campaign) error(404, 'Campaign not found');

	const { data: character } = await locals.supabase
		.from('characters')
		.select('id, name, player_name, image_path, character_code, data')
		.eq('id', params.charId)
		.eq('campaign_id', params.id)
		.is('deleted_at', null)
		.single();
	if (!character) error(404, 'Character not found');

	const { data: items } = await locals.supabase
		.from('items')
		.select('id, name, description, data')
		.eq('campaign_id', params.id)
		.order('name');

	return { campaign, character, items: items ?? [], setting: getSetting(campaign.setting_id) };
};
