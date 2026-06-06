import { error, fail } from '@sveltejs/kit';
import type { CharacterData, InventoryEntry } from '$lib/data/types';
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
}

export const load: PageServerLoad = async ({ locals, params }) => {
	await requireGm(locals, params.id);

	const { data: campaign } = await locals.supabase
		.from('campaigns')
		.select('id, name')
		.eq('id', params.id)
		.single();

	const { data: characters } = await locals.supabase
		.from('characters')
		.select('id, name')
		.eq('campaign_id', params.id)
		.order('name');

	const { data: items } = await locals.supabase
		.from('items')
		.select('id, name')
		.eq('campaign_id', params.id)
		.order('name');

	return {
		campaignId: campaign?.id ?? params.id,
		campaignName: campaign?.name ?? 'Campaign',
		characters: characters ?? [],
		items: items ?? []
	};
};

export const actions: Actions = {
	default: async ({ request, locals, params }) => {
		await requireGm(locals, params.id);

		const formData = await request.formData();
		const characterId = String(formData.get('characterId') ?? '');
		const itemId = String(formData.get('itemId') ?? '');
		const quantity = Math.max(1, Number(formData.get('quantity') ?? 1));

		if (!characterId || !itemId) {
			return fail(400, { error: 'Character and item are required.' });
		}

		const { data: character, error: charError } = await locals.supabase
			.from('characters')
			.select('data')
			.eq('id', characterId)
			.eq('campaign_id', params.id)
			.single();

		if (charError || !character) return fail(404, { error: 'Character not found.' });

		const { data: item, error: itemError } = await locals.supabase
			.from('items')
			.select('id, name, data')
			.eq('id', itemId)
			.eq('campaign_id', params.id)
			.single();

		if (itemError || !item) return fail(404, { error: 'Item not found.' });

		const sheet = character.data as CharacterData;
		const inventory = [...(sheet.inventory ?? [])];
		const existing = inventory.find((e) => e.itemId === itemId);

		if (existing) {
			existing.quantity += quantity;
		} else {
			const entry: InventoryEntry = {
				itemId,
				equipped: false,
				label: item.name,
				itemKind: 'consumable',
				features: { hasQuantity: true, hasDurability: false, hasAmmo: false, hasDamage: false },
				quantity
			};
			inventory.push(entry);
		}

		const { error: updateError } = await locals.supabase
			.from('characters')
			.update({ data: { ...sheet, inventory } })
			.eq('id', characterId)
			.eq('campaign_id', params.id);

		if (updateError) return fail(400, { error: updateError.message });
		return { success: true };
	}
};
