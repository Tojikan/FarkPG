import { browser } from '$app/environment';

export interface SavedCharacterCodes {
	campaignCode: string;
	characterCode: string;
	name: string;
}

const KEY = 'rpg-player-codes';

export function loadSavedCodes(): SavedCharacterCodes[] {
	if (!browser) return [];
	try {
		return JSON.parse(localStorage.getItem(KEY) ?? '[]');
	} catch {
		return [];
	}
}

export function rememberCodes(entry: SavedCharacterCodes) {
	if (!browser) return;
	const rest = loadSavedCodes().filter(
		(c) => c.campaignCode !== entry.campaignCode || c.characterCode !== entry.characterCode
	);
	localStorage.setItem(KEY, JSON.stringify([entry, ...rest].slice(0, 10)));
}

export function forgetCodes(entry: Pick<SavedCharacterCodes, 'campaignCode' | 'characterCode'>) {
	if (!browser) return;
	const rest = loadSavedCodes().filter(
		(c) => c.campaignCode !== entry.campaignCode || c.characterCode !== entry.characterCode
	);
	localStorage.setItem(KEY, JSON.stringify(rest));
}
