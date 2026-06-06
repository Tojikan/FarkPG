import type { SupabaseClient } from '@supabase/supabase-js';

export async function canViewCharacter(
	supabase: SupabaseClient,
	userId: string,
	character: { owner_id: string; campaign_id: string | null }
): Promise<boolean> {
	if (character.owner_id === userId) return true;
	if (!character.campaign_id) return false;

	const { data: membership } = await supabase
		.from('campaign_members')
		.select('role')
		.eq('campaign_id', character.campaign_id)
		.eq('user_id', userId)
		.maybeSingle();

	return !!membership;
}

export async function canEditCharacter(
	supabase: SupabaseClient,
	userId: string,
	character: { owner_id: string; campaign_id: string | null }
): Promise<boolean> {
	if (character.owner_id === userId) return true;
	if (!character.campaign_id) return false;

	const { data: membership } = await supabase
		.from('campaign_members')
		.select('role')
		.eq('campaign_id', character.campaign_id)
		.eq('user_id', userId)
		.maybeSingle();

	return membership?.role === 'gm';
}
