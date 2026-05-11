# FarkPG – Character schema

Structure of a character sheet and of saved/exported character data. Design so the same schema works for the web site and for other tools (editors, scripts, etc.).

## Core fields

- **attributes**: Map of attribute id → numeric value.
- **skills**: Map of category id → map of skill id → numeric value (plus support for custom skills per category).
- **abilities**: Map of ability id → level or 0/1 for non-levelable; plus optional list of custom abilities.
- **points**: Record of point pools (e.g. `attributes`, `skills` per category, `abilities`) and how many were allocated (for display or tool state).
- **custom**: Optional custom skills per category and custom abilities (label, value, description, cost, etc.).
- **xp** (optional): Experience value for the character (advancement, unlocks, or theme-specific use).
- **health** (optional): Current/max health for play.
- **fate**: Current and max Fate (resource currency). Max may be theme base + bonus.
- **bonusFatePoints** (optional): Extra starting fate added to the theme’s base; fate max = theme.fateMax + bonusFatePoints.

## Export/import

- Character data should be **serializable** (e.g. JSON) so it can be saved, loaded, and shared.
- Saved characters may include values or custom entries not present in the current theme (cross-compatibility). Consumers should tolerate unknown keys and preserve them on re-export where appropriate.

## Versioning

Consider a **schema version** or format version in the export so future tools can detect and migrate older character files.
