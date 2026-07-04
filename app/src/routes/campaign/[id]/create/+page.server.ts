import { error } from '@sveltejs/kit';
import { getSetting } from '$lib/settings';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const { data: campaign } = await locals.supabase
		.from('campaigns')
		.select('id, name, setting_id, campaign_code, max_characters')
		.eq('id', params.id)
		.single();

	if (!campaign) error(404, 'Campaign not found');

	const { count } = await locals.supabase
		.from('characters')
		.select('*', { count: 'exact', head: true })
		.eq('campaign_id', params.id)
		.is('deleted_at', null);

	const usedSlots = count ?? 0;
	if (usedSlots >= campaign.max_characters) {
		error(400, 'This campaign has no open character slots.');
	}

	return {
		campaign,
		setting: getSetting(campaign.setting_id),
		slotsRemaining: campaign.max_characters - usedSlots
	};
};
