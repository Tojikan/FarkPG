import { error, json } from '@sveltejs/kit';
import { mergeCharacterData, syncDerivedStats } from '$lib/data/character';
import { getTheme } from '$lib/data/themes';
import type { CharacterData } from '$lib/data/types';
import { canEditCharacter } from '$lib/server/characterAccess';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals, params }) => {
	const user = locals.user;
	if (!user) error(401, 'Unauthorized');

	const { data: character, error: charError } = await locals.supabase
		.from('characters')
		.select('owner_id, campaign_id, theme_id, data')
		.eq('id', params.charId)
		.single();

	if (charError || !character) error(404, 'Character not found');

	if (!(await canEditCharacter(locals.supabase, user.id, character))) {
		error(403, 'Not allowed');
	}

	const theme = getTheme(character.theme_id);
	if (!theme) error(400, 'Unknown theme');

	const body = await request.json();
	const name = String(body.name ?? '').trim();
	const incoming = body.data as CharacterData;

	const merged = mergeCharacterData({ ...(character.data as CharacterData), ...incoming }, theme);
	const synced = syncDerivedStats(merged, theme);

	const { error: updateError } = await locals.supabase
		.from('characters')
		.update({ name, data: synced })
		.eq('id', params.charId);

	if (updateError) error(400, updateError.message);
	return json({ ok: true, data: synced });
};
