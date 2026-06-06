import { coreTheme, DEFAULT_THEME_ID } from './core.js';
import type { Theme } from '../types.js';

export const themes: Record<string, Theme> = {
	core: coreTheme
};

export const themeList: Theme[] = [coreTheme];

/** Legacy theme ids map to the single core ruleset */
export function getTheme(id: string): Theme {
	return themes[id] ?? coreTheme;
}

export function resolveThemeId(id: string): string {
	return themes[id] ? id : DEFAULT_THEME_ID;
}

export { coreTheme, DEFAULT_THEME_ID };
