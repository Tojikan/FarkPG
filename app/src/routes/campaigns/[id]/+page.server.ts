import { error, fail, redirect } from '@sveltejs/kit';
import { createEmptyCharacterData } from '$lib/data/character';
import { portraitPublicUrl } from '$lib/data/portrait';
import { coreTheme, DEFAULT_THEME_ID, getTheme } from '$lib/data/themes';
import type { CharacterData } from '$lib/data/types';
import type { Actions, PageServerLoad } from './$types';

function portraitUrlFromData(data: unknown): string | null {
	const sheet = data as CharacterData | null;
	const path = sheet?.znz?.portraitPath;
	if (!path) return null;
	return portraitPublicUrl(path, sheet.znz?.portraitUpdatedAt);
}

function characterLevel(data: unknown): number {
	const sheet = data as CharacterData | null;
	const xp = sheet?.xp ?? 0;
	return Math.max(1, Math.floor(xp / 1000) + 1);
}

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

	const [{ count: memberCount }, { count: characterCount }, { data: characters, error: charError }] =
		await Promise.all([
			locals.supabase
				.from('campaign_members')
				.select('*', { count: 'exact', head: true })
				.eq('campaign_id', params.id),
			locals.supabase
				.from('characters')
				.select('*', { count: 'exact', head: true })
				.eq('campaign_id', params.id),
			locals.supabase
				.from('characters')
				.select('id, name, theme_id, owner_id, updated_at, data, profiles(display_name)')
				.eq('campaign_id', params.id)
				.order('updated_at', { ascending: false })
		]);

	if (charError) error(500, charError.message);

	const isGm = membership.role === 'gm';

	return {
		campaign,
		isGm,
		memberCount: memberCount ?? 0,
		characterCount: characterCount ?? 0,
		characters:
			characters?.map((c) => {
				const profile = Array.isArray(c.profiles) ? c.profiles[0] : c.profiles;
				const theme = getTheme(c.theme_id);
				const isOwner = c.owner_id === user.id;
				return {
					id: c.id,
					name: c.name,
					theme_label: theme?.label ?? c.theme_id,
					level: characterLevel(c.data),
					portrait_url: portraitUrlFromData(c.data),
					owner_name: profile?.display_name ?? 'Unknown',
					isOwner,
					canEdit: isOwner || isGm
				};
			}) ?? []
	};
};

export const actions: Actions = {
	createCharacter: async ({ request, locals, params }) => {
		const user = locals.user;
		if (!user) return fail(401, { error: 'Not authenticated.' });

		const { data: membership } = await locals.supabase
			.from('campaign_members')
			.select('role')
			.eq('campaign_id', params.id)
			.eq('user_id', user.id)
			.maybeSingle();

		if (!membership) return fail(403, { error: 'Not a campaign member.' });

		const name = String((await request.formData()).get('name') ?? '').trim();
		if (!name) return fail(400, { error: 'Name is required.' });

		const { data, error: insertError } = await locals.supabase
			.from('characters')
			.insert({
				campaign_id: params.id,
				owner_id: user.id,
				theme_id: DEFAULT_THEME_ID,
				name,
				data: createEmptyCharacterData(coreTheme)
			})
			.select('id')
			.single();

		if (insertError) return fail(400, { error: insertError.message });
		redirect(303, `/characters/${data.id}/build/attributes`);
	},

	leave: async ({ locals, params }) => {
		const user = locals.user;
		if (!user) return fail(401, { error: 'Not authenticated.' });

		const { data: membership } = await locals.supabase
			.from('campaign_members')
			.select('role')
			.eq('campaign_id', params.id)
			.eq('user_id', user.id)
			.maybeSingle();

		if (!membership) return fail(404, { error: 'Campaign not found.' });
		if (membership.role === 'gm') {
			return fail(400, { error: 'GMs cannot leave their own campaign. Delete it instead.' });
		}

		const { error: leaveError } = await locals.supabase
			.from('campaign_members')
			.delete()
			.eq('campaign_id', params.id)
			.eq('user_id', user.id);

		if (leaveError) return fail(400, { error: leaveError.message });
		redirect(303, '/campaigns');
	},

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
