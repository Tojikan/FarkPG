import { PUBLIC_SUPABASE_URL } from '$env/static/public';

export function characterImageUrl(path: string | null | undefined): string | null {
	if (!path) return null;
	return `${PUBLIC_SUPABASE_URL}/storage/v1/object/public/character-images/${path}`;
}
