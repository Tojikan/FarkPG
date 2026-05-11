# farkpg-znz — assistant context

Foundry **v13** tabletop system (`system.json`): character sheet with attributes (Body / Adroit / Mind), standard + custom skills, gear, abilities, biography.

## File map

| Area | Paths |
|------|--------|
| Entry | `scripts/farkpg.mjs` — **`init`** (models, **`getRollData`** patch, register sheets), **`ready`** (**`game.farkpg`**). No `setup` hook. |
| Config & caps | `scripts/config.mjs` — **`ATTR_VALUE_MAX` 6**, **`SKILL_VALUE_MAX` 4**, skill lists, roll key helpers. |
| Sheet data helpers | `scripts/actor-system.mjs` — **`normalizeSheetSystem`** only (display / inventory clones). Updates use Foundry **`TypeDataModel`** as-is; no `preUpdateActor` sanitization. |
| Lists / equip | `scripts/inventory.mjs` — stash vs equipped panels, **`system.isEquipped`** on items, slot cap via **`system.equipment.slotCount`**. |
| Rolls | `scripts/rolls.mjs` — `buildRollData`, `rollSkill` (`1d20 + @attr + @skill`). |
| Weapons | `scripts/weapons.mjs` — `useWeapon`, ammo burn, delegates to `rollSkill`. |
| Editors | `scripts/text-editor-ux.mjs` — **`textEditorUx()`** → **`foundry.applications.ux.TextEditor.implementation`** (V15-safe `enrichHTML`; sheets use it for bios / item HTML). |
| Models | `scripts/data-models.mjs` — `TypeDataModel` for character + item types (`registerDataModels`). |
| UI | **`ActorSheetV2` / `ItemSheetV2`** via **`HandlebarsApplicationMixin`** in `scripts/sheets/character-sheet.mjs`, `scripts/sheets/item-sheets.mjs`; templates `templates/`; **`lang/en.json`** (**`FARKPG.*`**); **`styles/farkpg.css`**. |

## Behaviors agents should preserve

- **Equip state** lives on **Items** (`weapon` / `consumable` / `equipment`): **`system.isEquipped`**. Actor holds **`equipment.slotCount`** and **`inventory.maxSlots`** only—not an equipped-id list on the actor.
- **Public API** (after **`ready`**): **`game.farkpg`**: `{ rollSkill, useWeapon, useWeaponById, buildRollData }`.
- **`getRollData`** is patched on the actor document class in **`init`**: merges attrs/skills/custom skills onto roll data for macros.
- Keep changes small; ES module imports relative to `scripts/`; **`node --check`** on touched `.mjs` when editing logic.
