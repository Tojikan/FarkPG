import type { SettingDefinition } from './types';
import lastEmpire from './last-empire.json';
import zombie from './zombie.json';

function validate(setting: SettingDefinition): SettingDefinition {
	const attrIds = new Set(setting.attributes.map((a) => a.id));
	const problems: string[] = [];

	for (const skill of setting.skills) {
		if (!attrIds.has(skill.attribute)) {
			problems.push(`skill "${skill.id}" references unknown attribute "${skill.attribute}"`);
		}
	}
	for (const resource of setting.resources) {
		const attr = resource.formula.attribute;
		if (attr && !attrIds.has(attr)) {
			problems.push(`resource "${resource.id}" references unknown attribute "${attr}"`);
		}
	}
	const { attributes: ac, skills: sc, abilities: bc } = setting.creation;
	if (ac.min > ac.start || ac.start > ac.max) {
		problems.push('attribute creation rules must satisfy min <= start <= max');
	}
	if (sc.rankCosts.length < sc.maxRank) {
		problems.push('skill rankCosts must cover maxRank entries');
	}
	if (bc.mode === 'point-buy' && (!bc.rankCosts || !bc.maxRank || bc.pool == null)) {
		problems.push('point-buy abilities need pool, maxRank, and rankCosts');
	}
	if (bc.mode === 'pick' && bc.count == null) {
		problems.push('pick abilities need count');
	}

	if (problems.length > 0) {
		throw new Error(`Invalid setting "${setting.id}": ${problems.join('; ')}`);
	}
	return setting;
}

const registry: Record<string, SettingDefinition> = Object.fromEntries(
	[lastEmpire as SettingDefinition, zombie as SettingDefinition]
		.map(validate)
		.map((s) => [s.id, s])
);

export const settingsList: SettingDefinition[] = Object.values(registry);

export function getSetting(id: string): SettingDefinition {
	const setting = registry[id];
	if (!setting) throw new Error(`Unknown setting: ${id}`);
	return setting;
}

export function skillsByAttribute(setting: SettingDefinition) {
	return setting.attributes.map((attribute) => ({
		attribute,
		skills: setting.skills.filter((s) => s.attribute === attribute.id)
	}));
}
