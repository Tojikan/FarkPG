import type { CharacterData, Theme } from '$lib/data/types';
import { syncDerivedStats, cloneSheetData } from '$lib/data/character';

export const BUILD_CTX = Symbol('build');

/** Reactive build state stored in context ($state object from the layout). */
export interface BuildStore {
	characterId: string;
	theme: Theme;
	characterName: string;
	sheetData: CharacterData;
}

export function setBuildCharacterName(store: BuildStore, name: string): void {
	store.characterName = name;
}

export function setBuildSheetData(store: BuildStore, next: CharacterData): void {
	store.sheetData = syncDerivedStats(cloneSheetData(next), store.theme);
}

export async function saveBuild(
	store: BuildStore,
	extra?: Partial<CharacterData>
): Promise<boolean> {
	if (extra) {
		store.sheetData = syncDerivedStats(cloneSheetData({ ...store.sheetData, ...extra }), store.theme);
	}
	const synced = syncDerivedStats(cloneSheetData(store.sheetData), store.theme);
	store.sheetData = synced;
	const res = await fetch(`/characters/${store.characterId}/save`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ name: store.characterName, data: synced })
	});
	return res.ok;
}
