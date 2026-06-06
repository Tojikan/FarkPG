import { error, json } from '@sveltejs/kit';
import {
	extensionForMime,
	portraitPublicUrl,
	portraitStoragePath,
	PORTRAIT_MAX_BYTES
} from '$lib/data/portrait';
import { mergeCharacterData, syncDerivedStats } from '$lib/data/character';
import { getTheme } from '$lib/data/themes';
import type { CharacterData } from '$lib/data/types';
import { canEditCharacter } from '$lib/server/characterAccess';
import type { RequestHandler } from './$types';

async function loadCharacter(locals: App.Locals, charId: string) {
	const { data: character, error: charError } = await locals.supabase
		.from('characters')
		.select('id, owner_id, campaign_id, theme_id, name, data')
		.eq('id', charId)
		.single();

	if (charError || !character) error(404, 'Character not found');
	return character;
}

export const POST: RequestHandler = async ({ request, locals, params }) => {
	const user = locals.user;
	if (!user) error(401, 'Unauthorized');

	const character = await loadCharacter(locals, params.charId);
	if (!(await canEditCharacter(locals.supabase, user.id, character))) {
		error(403, 'Not allowed');
	}

	const formData = await request.formData();
	const file = formData.get('file');
	if (!(file instanceof File)) error(400, 'Missing file');

	if (file.size <= 0 || file.size > PORTRAIT_MAX_BYTES) {
		error(400, 'Image must be between 1 byte and 5 MB');
	}

	const ext = extensionForMime(file.type);
	if (!ext) error(400, 'Unsupported image type');

	const path = portraitStoragePath(params.charId, ext);
	const { error: uploadError } = await locals.supabase.storage
		.from('character-portraits')
		.upload(path, file, { upsert: true, contentType: file.type });

	if (uploadError) error(400, uploadError.message);

	const theme = getTheme(character.theme_id);
	if (!theme) error(400, 'Unknown theme');

	const portraitUpdatedAt = new Date().toISOString();
	const merged = mergeCharacterData(
		{
			...(character.data as CharacterData),
			znz: {
				...(character.data as CharacterData).znz,
				portraitPath: path,
				portraitUpdatedAt
			}
		},
		theme
	);
	const synced = syncDerivedStats(merged, theme);

	const { error: updateError } = await locals.supabase
		.from('characters')
		.update({ data: synced })
		.eq('id', params.charId);

	if (updateError) error(400, updateError.message);

	return json({
		ok: true,
		portraitPath: path,
		portraitUpdatedAt,
		portraitUrl: portraitPublicUrl(path, portraitUpdatedAt)
	});
};

export const DELETE: RequestHandler = async ({ locals, params }) => {
	const user = locals.user;
	if (!user) error(401, 'Unauthorized');

	const character = await loadCharacter(locals, params.charId);
	if (!(await canEditCharacter(locals.supabase, user.id, character))) {
		error(403, 'Not allowed');
	}

	const sheet = character.data as CharacterData;
	const path = sheet.znz?.portraitPath;
	if (path) {
		await locals.supabase.storage.from('character-portraits').remove([path]);
	}

	const theme = getTheme(character.theme_id);
	if (!theme) error(400, 'Unknown theme');

	const merged = mergeCharacterData(
		{
			...sheet,
			znz: {
				...sheet.znz,
				portraitPath: undefined,
				portraitUpdatedAt: undefined
			}
		},
		theme
	);
	const synced = syncDerivedStats(merged, theme);

	const { error: updateError } = await locals.supabase
		.from('characters')
		.update({ data: synced })
		.eq('id', params.charId);

	if (updateError) error(400, updateError.message);

	return json({ ok: true });
};
