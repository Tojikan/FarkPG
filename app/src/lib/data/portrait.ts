import { PUBLIC_SUPABASE_URL } from '$env/static/public';

export const PORTRAIT_BUCKET = 'character-portraits';
export const PORTRAIT_MAX_BYTES = 5 * 1024 * 1024;
export const PORTRAIT_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif';

const EXT_BY_MIME: Record<string, string> = {
	'image/jpeg': 'jpg',
	'image/png': 'png',
	'image/webp': 'webp',
	'image/gif': 'gif'
};

export function extensionForMime(mime: string): string | null {
	return EXT_BY_MIME[mime] ?? null;
}

export function portraitStoragePath(characterId: string, ext: string): string {
	return `${characterId}/portrait.${ext}`;
}

export function portraitPublicUrl(path: string, cacheBust?: string | number): string {
	const base = `${PUBLIC_SUPABASE_URL}/storage/v1/object/public/${PORTRAIT_BUCKET}/${path}`;
	if (cacheBust == null || cacheBust === '') return base;
	return `${base}?v=${encodeURIComponent(String(cacheBust))}`;
}
