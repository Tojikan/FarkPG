import { error, redirect } from '@sveltejs/kit';
import { isBuilderComplete, mergeCharacterData } from '$lib/data/character';
import { getTheme } from '$lib/data/themes';
import { canEditCharacter, canViewCharacter } from '$lib/server/characterAccess';
import type { CharacterData } from '$lib/data/types';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, params }) => {
	const user = locals.user;
	if (!user) error(401, 'Unauthorized');

	const { data: character, error: charError } = await locals.supabase
		.from('characters')
		.select('id, name, theme_id, owner_id, campaign_id, data')
		.eq('id', params.charId)
		.single();

	if (charError || !character) error(404, 'Character not found');

	const canView = await canViewCharacter(locals.supabase, user.id, character);
	if (!canView) error(404, 'Character not found');

	const canEdit = await canEditCharacter(locals.supabase, user.id, character);
	if (!canEdit) redirect(303, `/characters/${params.charId}`);

	const theme = getTheme(character.theme_id);
	if (!theme) error(500, 'Unknown theme');

	const sheet = mergeCharacterData(character.data as CharacterData, theme);
	if (isBuilderComplete(sheet)) redirect(303, `/characters/${params.charId}`);

	let campaignName: string | null = null;
	if (character.campaign_id) {
		const { data: campaign } = await locals.supabase
			.from('campaigns')
			.select('name')
			.eq('id', character.campaign_id)
			.single();
		campaignName = campaign?.name ?? null;
	}

	return {
		characterId: character.id,
		characterName: character.name,
		sheetData: sheet,
		theme,
		campaignId: character.campaign_id,
		campaignName
	};
};
