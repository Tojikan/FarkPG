import { fail, redirect } from '@sveltejs/kit';
import { createEmptyCharacterData, generateInviteCode } from '$lib/data/character';
import { getTheme } from '$lib/data/themes';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const user = locals.user;
	if (!user) return { campaigns: [], characters: [] };

	const { data: memberships, error: memberError } = await locals.supabase
		.from('campaign_members')
		.select('role, campaigns(id, name, invite_code, created_at)')
		.eq('user_id', user.id);

	if (memberError) console.error(memberError);

	const campaigns =
		memberships?.flatMap((m) => {
			const c = m.campaigns as
				| { id: string; name: string; invite_code: string; created_at: string }
				| { id: string; name: string; invite_code: string; created_at: string }[]
				| null;
			if (!c || Array.isArray(c)) return [];
			return [
				{
					id: c.id,
					name: c.name,
					invite_code: c.invite_code,
					created_at: c.created_at,
					role: m.role as 'gm' | 'player'
				}
			];
		}) ?? [];

	const { data: characters, error: charError } = await locals.supabase
		.from('characters')
		.select('id, name, theme_id, campaign_id, updated_at, campaigns(name)')
		.eq('owner_id', user.id)
		.order('updated_at', { ascending: false });

	if (charError) console.error(charError);

	return {
		campaigns,
		characters:
			characters?.map((c) => {
				const campaign = Array.isArray(c.campaigns) ? c.campaigns[0] : c.campaigns;
				return {
					id: c.id,
					name: c.name,
					theme_id: c.theme_id,
					campaign_id: c.campaign_id,
					campaign_name: (campaign as { name: string } | null)?.name ?? null
				};
			}) ?? []
	};
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { error: 'Not authenticated.' });

		const name = String((await request.formData()).get('name') ?? '').trim();
		if (!name) return fail(400, { error: 'Campaign name is required.' });

		const inviteCode = generateInviteCode();
		const { data, error } = await locals.supabase.rpc('create_campaign', {
			p_name: name,
			p_invite_code: inviteCode
		});

		if (error) return fail(400, { error: error.message });
		redirect(303, `/campaigns/${data}`);
	},

	join: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { error: 'Not authenticated.' });

		const inviteCode = String((await request.formData()).get('inviteCode') ?? '').trim();
		if (!inviteCode) return fail(400, { error: 'Invite code is required.' });

		const { data, error } = await locals.supabase.rpc('join_campaign', {
			p_invite_code: inviteCode
		});

		if (error) return fail(400, { error: error.message });
		redirect(303, `/campaigns/${data}`);
	},

	createCharacter: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { error: 'Not authenticated.' });

		const formData = await request.formData();
		const name = String(formData.get('name') ?? '').trim();
		const themeId = String(formData.get('themeId') ?? 'basic');

		const theme = getTheme(themeId);
		if (!theme) return fail(400, { error: 'Invalid theme.' });
		if (!name) return fail(400, { error: 'Name is required.' });

		const { data, error: insertError } = await locals.supabase
			.from('characters')
			.insert({
				campaign_id: null,
				owner_id: locals.user.id,
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
