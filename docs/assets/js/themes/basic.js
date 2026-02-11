// Basic Theme for FarkPG Character Builder
const BasicTheme = {
  name: "Basic",
  
  points: {
    attributes: 18,
    skills: {
      combat: 5,
      social: 5,
      knowledge: 5
    },
    abilities: 10
  },

  attributes: [
    { id: "strength", label: "Strength", abbr: "STR", min: 1, max: 6, default: 3 },
    { id: "agility", label: "Agility", abbr: "AGI", min: 1, max: 6, default: 3 },
    { id: "endurance", label: "Endurance", abbr: "END", min: 1, max: 6, default: 3 },
    { id: "intelligence", label: "Intelligence", abbr: "INT", min: 1, max: 6, default: 3 },
    { id: "willpower", label: "Willpower", abbr: "WIL", min: 1, max: 6, default: 3 },
    { id: "charisma", label: "Charisma", abbr: "CHA", min: 1, max: 6, default: 3 }
  ],

  skills: {
    combat: {
      label: "Combat",
      alwaysDisplay: true,
      max: 4,
      skills: [
        { id: "melee", label: "Melee", attribute: "strength", description: "Close-quarters fighting with swords, axes, and other handheld weapons" },
        { id: "ranged", label: "Ranged", attribute: "agility", description: "Attacks with bows, crossbows, thrown weapons, and firearms" },
        { id: "defense", label: "Defense", attribute: "endurance", description: "Blocking, parrying, and avoiding incoming attacks" }
      ]
    },
    social: {
      label: "Social",
      alwaysDisplay: true,
      max: 4,
      skills: [
        { id: "persuasion", label: "Persuasion", attribute: "charisma", description: "Convincing others through charm, logic, or negotiation" },
        { id: "intimidation", label: "Intimidation", attribute: "strength", description: "Coercing others through threats or displays of power" },
        { id: "insight", label: "Insight", attribute: "intelligence", description: "Reading body language and detecting lies or hidden motives" }
      ]
    },
    knowledge: {
      label: "Knowledge",
      alwaysDisplay: false,
      max: 4,
      skills: [
        { id: "lore", label: "Lore", attribute: "intelligence", description: "Historical knowledge, legends, and arcane information" },
        { id: "medicine", label: "Medicine", attribute: "intelligence", description: "Treating wounds, curing diseases, and understanding anatomy" },
        { id: "survival", label: "Survival", attribute: "willpower", description: "Navigating wilderness, finding food, and enduring harsh conditions" }
      ]
    }
  },

  abilities: [
    { 
      id: "toughness", 
      label: "Toughness", 
      cost: 2,
      levelable: true,
      maxLevel: 3,
      description: "Your character has developed an exceptional resilience to physical harm. Reduce all incoming damage by 1 point per level, to a minimum of 0. This ability stacks with armor and other defensive bonuses."
    },
    { 
      id: "quickstrike", 
      label: "Quick Strike", 
      cost: 3,
      description: "Years of training have honed your reflexes to a razor's edge. You always act first in combat encounters, regardless of initiative rolls. If multiple characters have this ability, they roll against each other."
    },
    { 
      id: "healer", 
      label: "Healer", 
      cost: 2,
      levelable: true,
      maxLevel: 5,
      description: "You possess knowledge of medicine and healing arts. Once per rest, you can restore 1d6 health points per level to yourself or an ally within touch range."
    },
    { 
      id: "iron_will", 
      label: "Iron Will", 
      cost: 3,
      description: "Your mental fortitude is unshakeable. You gain advantage on all saving throws against mind-affecting abilities, fear effects, and attempts to control or influence your actions against your will."
    }
  ],

  health: {
    max: 10000
  }
};

// Export for use
if (typeof window !== 'undefined') {
  window.Themes = window.Themes || {};
  window.Themes.Basic = BasicTheme;
}
