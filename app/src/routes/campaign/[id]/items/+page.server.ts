import { error, fail } from '@sveltejs/kit';
import { getSetting } from '$lib/settings';
import type { SettingDefinition } from '$lib/settings/types';
import type { Actions, PageServerLoad } from './$types';

function parseItemData(form: FormData, setting: SettingDefinition) {
	const data: Record<string, string | number> = {};
	for (const field of setting.itemFields) {
		const raw = String(form.get(`field_${field.id}`) ?? '').trim();
		if (!raw) continue;
		data[field.id] = field.type === 'number' ? Number(raw) : raw;
	}
	return data;
}

async function loadCampaign(locals: App.Locals, id: string) {
	const { data: campaign } = await locals.supabase
		.from('campaigns')
		.select('id, name, setting_id')
		.eq('id', id)
		.single();
	if (!campaign) error(404, 'Campaign not found');
	return campaign;
}

export const load: PageServerLoad = async ({ locals, params }) => {
	const campaign = await loadCampaign(locals, params.id);
	const { data: items } = await locals.supabase
		.from('items')
		.select('id, name, description, data, created_at')
		.eq('campaign_id', params.id)
		.order('created_at', { ascending: false });

	return { campaign, items: items ?? [], setting: getSetting(campaign.setting_id) };
};

export const actions: Actions = {
	create: async ({ request, locals, params }) => {
		const campaign = await loadCampaign(locals, params.id);
		const setting = getSetting(campaign.setting_id);
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		if (!name) return fail(400, { message: 'Item name is required.' });

		const { error: err } = await locals.supabase.from('items').insert({
			campaign_id: params.id,
			name,
			description: String(form.get('description') ?? '').trim(),
			data: parseItemData(form, setting)
		});

		if (err) return fail(500, { message: 'Could not create the item.' });
		return { success: true };
	},

	update: async ({ request, locals, params }) => {
		const campaign = await loadCampaign(locals, params.id);
		const setting = getSetting(campaign.setting_id);
		const form = await request.formData();
		const id = String(form.get('item_id') ?? '');
		const name = String(form.get('name') ?? '').trim();
		if (!name) return fail(400, { message: 'Item name is required.' });

		const { error: err } = await locals.supabase
			.from('items')
			.update({
				name,
				description: String(form.get('description') ?? '').trim(),
				data: parseItemData(form, setting)
			})
			.eq('id', id)
			.eq('campaign_id', params.id);

		if (err) return fail(500, { message: 'Could not update the item.' });
		return { success: true };
	},

	delete: async ({ request, locals, params }) => {
		const form = await request.formData();
		const id = String(form.get('item_id') ?? '');
		const { error: err } = await locals.supabase
			.from('items')
			.delete()
			.eq('id', id)
			.eq('campaign_id', params.id);

		if (err) return fail(500, { message: 'Could not delete the item.' });
		return { success: true };
	},

	seedTemplates: async ({ locals, params }) => {
		const campaign = await loadCampaign(locals, params.id);
		const setting = getSetting(campaign.setting_id);

		const rows = setting.itemTemplates.map((t) => ({
			campaign_id: params.id,
			name: t.name,
			description: t.description ?? '',
			data: t.data ?? {}
		}));
		if (rows.length === 0) return { success: true };

		const { error: err } = await locals.supabase.from('items').insert(rows);
		if (err) return fail(500, { message: 'Could not add starter items.' });
		return { success: true };
	}
};
