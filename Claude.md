# farkpg-znz — assistant context

Foundry **v13** tabletop system (`system.json`): character sheet with attributes (Body / Adroit / Mind), standard + custom skills, gear, abilities, biography.

## File map

| Area | Paths |
|------|--------|
| Entry | `scripts/farkpg.mjs` — hooks only (`init` / `setup` / `ready`). |
| Config & caps | `scripts/config.mjs` — **`ATTR_VALUE_MAX` 6**, **`SKILL_VALUE_MAX` 4**, skill lists, roll key helpers. |
| Actor patching | `scripts/actor-system.mjs` — `normalizeSheetSystem`, **`sanitizeCharacterSystemPatch`** (used in `preUpdateActor`). |
| Lists / equip | `scripts/inventory.mjs` — stash vs equipped panels, **`system.isEquipped`** on items, slot cap via **`system.equipment.slotCount`**. |
| Rolls | `scripts/rolls.mjs` — `buildRollData`, `rollSkill` (`1d20 + @attr + @skill`). |
| Weapons | `scripts/weapons.mjs` — `useWeapon`, ammo burn, delegates to `rollSkill`. |
| Migration | `scripts/migration.mjs` — legacy **`equipment.equippedIds`** → **`isEquipped`** (GM on `ready`). |
| Models | `scripts/data-models.mjs` — `TypeDataModel` for character + item types (`registerDataModels`). |
| UI | `scripts/sheets/character-sheet.mjs`, `scripts/sheets/item-sheets.mjs`; templates `templates/`; **`lang/en.json`** keys under **`FARKPG.*`**; **`styles/farkpg.css`**. |

## Behaviors agents should preserve

- **Equip state** lives on **Items** (`weapon` / `consumable` / `equipment`): **`system.isEquipped`**. Actor holds **`equipment.slotCount`** and **`inventory.maxSlots`** only—not an equipped-id list on the actor.
- **Public API** (after ready): **`game.farkpg`**: `{ rollSkill, useWeapon, useWeaponById, buildRollData }`.
- **`getRollData`** is patched on the actor document class (`setup`): merged attrs/skills/custom skills for macros.
- Don’t widen scope: small diffs; keep ES module imports relative to `scripts/`; **`node --check`** on touched `.mjs` when editing logic.
