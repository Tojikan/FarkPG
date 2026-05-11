# farkpg-znz — assistant context

Foundry **v13** tabletop system (`system.json`): character sheet with attributes (Body / Adroit / Mind), standard + custom skills, gear, abilities, biography.

**No `TypeDataModel`:** actor/item `system` data comes from **`template.json`** and plain document behavior. **`rolls.mjs`** builds a temporary data object only when resolving `rollSkill` formulas.

## File map

| Area | Paths |
|------|--------|
| Entry | `scripts/farkpg.mjs` — **`init`** (register sheets only), **`ready`** (**`game.farkpg`**). |
| Config & caps | `scripts/config.mjs` — **`ATTR_VALUE_MAX` 6**, **`SKILL_VALUE_MAX` 4**, skill lists, roll key helpers. |
| Lists / equip | `scripts/inventory.mjs` — stash vs equipped panels, **`system.isEquipped`** on items, **`system.equipment.slotCount`**. |
| Rolls | `scripts/rolls.mjs` — internal **`rollDataPool(actor)`**, **`rollSkill`** (`1d20 + @attr [+ @skill]`). Not exposed on **`Actor#getRollData`**. |
| Weapons | `scripts/weapons.mjs` — **`useWeapon`**, ammo burn → **`rollSkill`**. |
| Editors | `scripts/text-editor-ux.mjs` — **`textEditorUx()`** → **`TextEditor.implementation`** (`enrichHTML`). |
| UI | **`ActorSheetV2` / `ItemSheetV2`** + **`HandlebarsApplicationMixin`**; `templates/`; **`lang/en.json`** (**`FARKPG.*`**); **`styles/farkpg.css`**. |

## Character sheet rolls (template)

- **d20 buttons** (`farkpg-roll-btn`, Font Awesome **`fa-dice-d20`**) sit **between** the label and the number input (immediately left of the value field). Labels use **`farkpg-inline-label`**; custom skills use the name text field as the label area.
- Classes **`rollable`** + **`attr-roll`** / **`skill-roll`** + `data-attr` / `data-skill` drive **`character-sheet.mjs`** click handlers (**`rollSkill`**).

## Behaviors agents should preserve

- **Equip state** on items: **`system.isEquipped`**. Actor **`equipment.slotCount`** and **`inventory.maxSlots`** only.
- **Public API** (`ready`): **`game.farkpg`**: **`{ rollSkill, useWeapon, useWeaponById }`** — no **`buildRollData`**, no prototype patches.
- For macros/charts that need totals, reference **`actor.system.attributes.*`**, **`actor.system.skills.*`**, and custom skills on **`actor.system.customSkills`** (or call **`game.farkpg.rollSkill(actor, attr, skillId)`**).
- Small diffs; relative `scripts/` imports; **`node --check`** on edited `.mjs`.
