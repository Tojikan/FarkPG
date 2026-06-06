import { fail, redirect } from '@sveltejs/kit';
import { createEmptyCharacterData, generateInviteCode } from '$lib/data/character';
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

export const load: PageServerLoad = async ({ locals }) => {
	const user = locals.user;
	if (!user) return { campaigns: [], characters: [], displayName: 'Adventurer' };

	const { data: profile } = await locals.supabase
		.from('profiles')
		.select('display_name')
		.eq('id', user.id)
		.single();

	const { data: memberships, error: memberError } = await locals.supabase
		.from('campaign_members')
		.select('role, campaigns(id, name, invite_code, created_at)')
		.eq('user_id', user.id);

	if (memberError) console.error(memberError);

	const campaignsRaw =
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
		.select('id, name, theme_id, campaign_id, updated_at, data, campaigns(name)')
		.eq('owner_id', user.id)
		.order('updated_at', { ascending: false });

	if (charError) console.error(charError);

	const charactersList =
		characters?.map((c) => {
			const campaign = Array.isArray(c.campaigns) ? c.campaigns[0] : c.campaigns;
			const theme = getTheme(c.theme_id);
			return {
				id: c.id,
				name: c.name,
				theme_id: c.theme_id,
				theme_label: theme.label,
				campaign_id: c.campaign_id,
				campaign_name: (campaign as { name: string } | null)?.name ?? null,
				level: characterLevel(c.data),
				portrait_url: portraitUrlFromData(c.data),
				updated_at: c.updated_at
			};
		}) ?? [];

	const campaigns = await Promise.all(
		campaignsRaw.map(async (campaign) => {
			const [{ count: memberCount }, { count: characterCount }] = await Promise.all([
				locals.supabase
					.from('campaign_members')
					.select('*', { count: 'exact', head: true })
					.eq('campaign_id', campaign.id),
				locals.supabase
					.from('characters')
					.select('*', { count: 'exact', head: true })
					.eq('campaign_id', campaign.id)
			]);

			const myCharacters = charactersList
				.filter((ch) => ch.campaign_id === campaign.id)
				.map((ch) => ({
					id: ch.id,
					name: ch.name,
					portrait_url: ch.portrait_url
				}));

			return {
				...campaign,
				member_count: memberCount ?? 0,
				character_count: characterCount ?? 0,
				my_characters: myCharacters
			};
		})
	);

	return {
		displayName: profile?.display_name ?? 'Adventurer',
		campaigns,
		characters: charactersList
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
		if (!name) return fail(400, { error: 'Name is required.' });

		const { data, error: insertError } = await locals.supabase
			.from('characters')
			.insert({
				campaign_id: null,
				owner_id: locals.user.id,
				theme_id: DEFAULT_THEME_ID,
				name,
				data: createEmptyCharacterData(coreTheme)
			})
			.select('id')
			.single();

		if (insertError) return fail(400, { error: insertError.message });
		redirect(303, `/characters/${data.id}/build/attributes`);
	},

	deleteCharacter: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { error: 'Not authenticated.' });

		const characterId = String((await request.formData()).get('characterId') ?? '');
		if (!characterId) return fail(400, { error: 'Character id required.' });

		const { data: character } = await locals.supabase
			.from('characters')
			.select('owner_id')
			.eq('id', characterId)
			.single();

		if (!character || character.owner_id !== locals.user.id) {
			return fail(403, { error: 'Not allowed.' });
		}

		const { error: deleteError } = await locals.supabase.from('characters').delete().eq('id', characterId);
		if (deleteError) return fail(400, { error: deleteError.message });
		redirect(303, '/campaigns');
	},

	assignCharacter: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { error: 'Not authenticated.' });

		const formData = await request.formData();
		const characterId = String(formData.get('characterId') ?? '');
		const campaignId = String(formData.get('campaignId') ?? '');
		if (!characterId || !campaignId) {
			return fail(400, { error: 'Character and campaign are required.' });
		}

		const { data: character } = await locals.supabase
			.from('characters')
			.select('owner_id, campaign_id')
			.eq('id', characterId)
			.single();

		if (!character || character.owner_id !== locals.user.id) {
			return fail(403, { error: 'Not allowed.' });
		}

		const { data: membership } = await locals.supabase
			.from('campaign_members')
			.select('role')
			.eq('campaign_id', campaignId)
			.eq('user_id', locals.user.id)
			.single();

		if (!membership) {
			return fail(403, { error: 'You are not a member of that campaign.' });
		}

		const { error: updateError } = await locals.supabase
			.from('characters')
			.update({ campaign_id: campaignId })
			.eq('id', characterId);

		if (updateError) return fail(400, { error: updateError.message });
		return { success: true };
	},

	unassignCharacter: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { error: 'Not authenticated.' });

		const characterId = String((await request.formData()).get('characterId') ?? '');
		if (!characterId) return fail(400, { error: 'Character id required.' });

		const { data: character } = await locals.supabase
			.from('characters')
			.select('owner_id')
			.eq('id', characterId)
			.single();

		if (!character || character.owner_id !== locals.user.id) {
			return fail(403, { error: 'Not allowed.' });
		}

		const { error: updateError } = await locals.supabase
			.from('characters')
			.update({ campaign_id: null })
			.eq('id', characterId);

		if (updateError) return fail(400, { error: updateError.message });
		return { success: true };
	}
};
