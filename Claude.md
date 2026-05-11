# FarkPG-ZnZ — short guide for assistants

Custom **FoundryVTT v13** system. Single actor type (`character`), four item types (`weapon`, `consumable`, `equipment`, `ability`). Built on ApplicationV2 + HandlebarsApplicationMixin.

## What it does

- One **character** actor with a header (image, name, HP, AP, EXP, Move), three tabs (Character / Inventory / Config), and an editable biography at the bottom of the Character tab.
- Character tab has a **right-side sidebar** listing **3 attributes** (`body`, `adroit`, `mind`) with their **skills indented beneath**. Each row has a value input, a `fa-dice-d20` button that rolls `1d20 + attribute + skill`, and a `fa-dice` button that opens the **Virtual Dice Table** module via `globalThis.virtualDiceTable?.open()` / `game.modules.get("virtual-dice-table")?.api?.openVirtualTable()`. A `+` button under each attribute adds a **custom skill** for that attribute.
- Character tab's **main area** lists **equipped items** (any item with `system.isEquipped`) and **abilities** (item type `ability`). Equipment section header shows a read-only `count / max` slot counter.
- Inventory tab lists **non-equipped, non-ability** items and provides **+Add** buttons (one per inventory item type). Header shows a read-only `count / max` slot counter.
- Config tab edits **equipment slot count** and **inventory slot count** (and the base resource maxes).

## Main files

- `system.json` — manifest (id, esmodules, styles, lang, documentTypes/htmlFields).
- `template.json` — actor/item default data shape (no `system` wrapper inside types).
- `scripts/farkpg.mjs` — `init`/`ready` hooks, Handlebars helpers, sheet registration.
- `scripts/sheets/character-sheet.mjs` — `HandlebarsApplicationMixin(ActorSheetV2)` with PARTS/TABS, actions, roll handlers, custom-skill CRUD.
- `scripts/sheets/item-sheet.mjs` — `HandlebarsApplicationMixin(ItemSheetV2)` simple description/properties form.
- `scripts/config.mjs` — `ATTRIBUTE_SKILLS` map (which built-in skills belong to which attribute) and labels.
- `templates/actor/parts/header.hbs` — portrait + name + resources strip.
- `templates/actor/parts/tab-character.hbs` — equipment/abilities/biography main column + attributes/skills sidebar.
- `templates/actor/parts/tab-inventory.hbs` — non-equipped items with create buttons.
- `templates/actor/parts/tab-config.hbs` — slot maxes and base resource maxes.
- `templates/item/item.hbs` — generic item sheet (works for all four types).
- `styles/farkpg.css` — layout/theming.
- `lang/en.json` — `FARKPG.*` localizations.

## Data shape

Actor (`system`):
- `attributes.{body|adroit|mind}` — number
- `skills.<skillKey>` — number (built-in skills, see `ATTRIBUTE_SKILLS`)
- `customSkills.<id>` — `{ id, name, attribute: "body"|"adroit"|"mind", value: number }`
- `resources.health.{value,max}`, `resources.actionPoints.{value,max}`, `resources.exp.{value,max}`, `resources.movement`
- `config.{equipmentSlots, inventorySlots}`
- `biography` — html string

Item (`system`):
- common: `description`, `isEquipped` (not on `ability`)
- `weapon`: `+ durability.{value,max}, rollable.{multiplier,max}, weaponStyle, ammo.{enabled,perUse,linkedConsumableId}`
- `consumable`: `+ durability, rollable, quantity.{value,max}`
- `equipment`: `+ durability, rollable`
- `ability`: `description, cost, rank, maxRank`

## Sheet conventions

- ApplicationV2 actions (declared in `static DEFAULT_OPTIONS.actions`) — handlers are **static** and receive `(event, target)`; `this` is the sheet instance.
- Tabs use the v13 native system: `static TABS = { primary: { tabs: [...], initial, labelPrefix } }`. The renderer adds `tab.cssClass` based on `tabGroups`; `_preparePartContext` sets `context.tab = context.tabs[partId]` for each tab part.
- Custom skills are a **keyed object** (not an array) so they can be safely deleted with `-=<id>` paths.
- Roll: `new Roll("1d20 + @atr + @skl", { atr, skl }).toMessage({ flavor })`. Roll button uses `data-action="rollSkill"` with `data-attribute` and optional `data-skill` / `data-custom-id`.
- Virtual dice table button: `data-action="openDiceTable"` — tries `virtualDiceTable.open()` first, falls back to module API.

## Edits

Keep this small. Don't introduce a build pipeline or DataModels unless it solves a concrete problem. Match existing v13 ApplicationV2 patterns shown in the Virtual Dice Table module (`foundry/modules/virtual-dice-table` in the FarkPG repo).
