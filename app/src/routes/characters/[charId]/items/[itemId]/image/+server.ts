import { error, json } from '@sveltejs/kit';
import { itemImagePublicUrl, itemImageStoragePath } from '$lib/data/items';
import { extensionForMime, PORTRAIT_MAX_BYTES } from '$lib/data/portrait';
import { canEditCharacter } from '$lib/server/characterAccess';
import type { RequestHandler } from './$types';

const BUCKET = 'character-portraits';

async function assertCanEdit(locals: App.Locals, charId: string) {
	const user = locals.user;
	if (!user) error(401, 'Unauthorized');

	const { data: character, error: charError } = await locals.supabase
		.from('characters')
		.select('id, owner_id, campaign_id')
		.eq('id', charId)
		.single();

	if (charError || !character) error(404, 'Character not found');
	if (!(await canEditCharacter(locals.supabase, user.id, character))) {
		error(403, 'Not allowed');
	}

	return character;
}

export const POST: RequestHandler = async ({ request, locals, params }) => {
	await assertCanEdit(locals, params.charId);

	const formData = await request.formData();
	const file = formData.get('file');
	if (!(file instanceof File)) error(400, 'Missing file');

	if (file.size <= 0 || file.size > PORTRAIT_MAX_BYTES) {
		error(400, 'Image must be between 1 byte and 5 MB');
	}

	const ext = extensionForMime(file.type);
	if (!ext) error(400, 'Unsupported image type');

	const path = itemImageStoragePath(params.charId, params.itemId, ext);
	const { error: uploadError } = await locals.supabase.storage
		.from(BUCKET)
		.upload(path, file, { upsert: true, contentType: file.type });

	if (uploadError) error(400, uploadError.message);

	const imageUpdatedAt = new Date().toISOString();
	return json({
		ok: true,
		imagePath: path,
		imageUpdatedAt,
		imageUrl: itemImagePublicUrl(path, imageUpdatedAt)
	});
};

export const DELETE: RequestHandler = async ({ url, locals, params }) => {
	await assertCanEdit(locals, params.charId);

	const path = url.searchParams.get('path');
	if (path) {
		await locals.supabase.storage.from(BUCKET).remove([path]);
	}

	return json({ ok: true });
};
