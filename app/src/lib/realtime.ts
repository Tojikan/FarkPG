import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';

/**
 * Live sheet sync uses one broadcast channel per character
 * (`character:{id}`). Whoever saves broadcasts a `saved` event tagged with
 * its own client id; other open clients refetch. This avoids table-level
 * realtime, which anon players couldn't subscribe to anyway.
 */
export function characterChannel(
	supabase: SupabaseClient,
	characterId: string,
	clientId: string,
	onRemoteSave: () => void
): RealtimeChannel {
	const channel = supabase.channel(`character:${characterId}`);
	channel
		.on('broadcast', { event: 'saved' }, ({ payload }) => {
			if (payload?.clientId !== clientId) onRemoteSave();
		})
		.subscribe();
	return channel;
}

export function announceSave(channel: RealtimeChannel, clientId: string) {
	channel.send({ type: 'broadcast', event: 'saved', payload: { clientId } });
}
