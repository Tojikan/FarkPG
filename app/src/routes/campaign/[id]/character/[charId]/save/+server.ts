import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

interface SavePayload {
	name: string;
	player_name: string;
	image_path: string | null;
	data: Record<string, unknown>;
}

/** GM autosave endpoint. RLS restricts the update to the GM's own campaigns. */
export const POST: RequestHandler = async ({ request, locals, params }) => {
	const body = (await request.json()) as SavePayload;

	const { error } = await locals.supabase
		.from('characters')
		.update({
			name: body.name,
			player_name: body.player_name,
			image_path: body.image_path,
			data: body.data
		})
		.eq('id', params.charId)
		.eq('campaign_id', params.id);

	if (error) return json({ ok: false }, { status: 500 });
	return json({ ok: true });
};
