import { basicTheme } from './basic.js';
import { neonCityTheme } from './cyberpunk.js';
import { znzTheme } from './znz.js';
import type { Theme } from '../types.js';

export const themes: Record<string, Theme> = {
	basic: basicTheme,
	neonCity: neonCityTheme,
	znz: znzTheme
};

export const themeList: Theme[] = [basicTheme, neonCityTheme, znzTheme];

export function getTheme(id: string): Theme | undefined {
	return themes[id];
}

export { basicTheme, neonCityTheme, znzTheme };
