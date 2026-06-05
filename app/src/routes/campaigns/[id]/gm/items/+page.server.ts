import { error, fail } from '@sveltejs/kit';
import type { ItemData } from '$lib/data/types';
import type { Actions, PageServerLoad } from './$types';

async function requireGm(locals: App.Locals, campaignId: string) {
	const user = locals.user;
	if (!user) error(401, 'Unauthorized');

	const { data: membership } = await locals.supabase
		.from('campaign_members')
		.select('role')
		.eq('campaign_id', campaignId)
		.eq('user_id', user.id)
		.maybeSingle();

	if (!membership || membership.role !== 'gm') error(403, 'GM only');
	return user;
}

function parseItemForm(formData: FormData): { name: string; data: ItemData } {
	const name = String(formData.get('name') ?? '').trim();
	const type = String(formData.get('type') ?? 'misc');
	const description = String(formData.get('description') ?? '').trim();
	const equipSlot = String(formData.get('equipSlot') ?? '').trim();
	const damage = String(formData.get('damage') ?? '').trim();

	return {
		name,
		data: {
			schemaVersion: 1,
			type,
			description,
			equipSlot: equipSlot || null,
			stats: damage ? { damage } : {},
			tags: []
		}
	};
}

export const load: PageServerLoad = async ({ locals, params }) => {
	await requireGm(locals, params.id);

	const { data: campaign } = await locals.supabase
		.from('campaigns')
		.select('id, name')
		.eq('id', params.id)
		.single();

	const { data: items, error: itemsError } = await locals.supabase
		.from('items')
		.select('id, name, data, created_at')
		.eq('campaign_id', params.id)
		.order('name');

	if (itemsError) error(500, itemsError.message);

	return {
		campaignId: campaign?.id ?? params.id,
		campaignName: campaign?.name ?? 'Campaign',
		items: items ?? []
	};
};

export const actions: Actions = {
	create: async ({ request, locals, params }) => {
		const user = await requireGm(locals, params.id);
		const parsed = parseItemForm(await request.formData());
		if (!parsed.name) return fail(400, { error: 'Name is required.' });

		const { error: insertError } = await locals.supabase.from('items').insert({
			campaign_id: params.id,
			name: parsed.name,
			data: parsed.data,
			created_by: user.id
		});

		if (insertError) return fail(400, { error: insertError.message });
		return { success: true };
	},

	update: async ({ request, locals, params }) => {
		await requireGm(locals, params.id);
		const formData = await request.formData();
		const itemId = String(formData.get('itemId') ?? '');
		const parsed = parseItemForm(formData);
		if (!itemId || !parsed.name) return fail(400, { error: 'Invalid item.' });

		const { error: updateError } = await locals.supabase
			.from('items')
			.update({ name: parsed.name, data: parsed.data })
			.eq('id', itemId)
			.eq('campaign_id', params.id);

		if (updateError) return fail(400, { error: updateError.message });
		return { success: true };
	},

	delete: async ({ request, locals, params }) => {
		await requireGm(locals, params.id);
		const itemId = String((await request.formData()).get('itemId') ?? '');
		if (!itemId) return fail(400, { error: 'Invalid item.' });

		const { error: deleteError } = await locals.supabase
			.from('items')
			.delete()
			.eq('id', itemId)
			.eq('campaign_id', params.id);

		if (deleteError) return fail(400, { error: deleteError.message });
		return { success: true };
	}
};
