# Virtual Dice Table — short guide for assistants

Simple Foundry **v13** module: a window where each player has **their own dice board**. Everyone can **view** other boards via tabs; only the **owner** or a **GM** can change a board. **GMs** also get a **private** board tab that players never see.

## What it does

- Each board has **`rollInProgress`**. Until **Start roll**, the window only shows that button (plus tabs). **End roll** clears all dice and score and sets die type to default; **Overview** lists only boards with a roll in progress (read-only). **Reset score** clears only the score column during a roll (toolbar).
- **`sharedBoard`** in state: **Shared board** tab; any logged-in user may mutate it (`SHARED_BOARD_ID`).
- **Rolling area**: roll N dice (d4–d20). Dice show numbers; **d6** uses **SVG pips**.
- **Score**: rows of dice (sets). Drag from rolling area into score: **empty score space** = **new row**; **onto a row** = **add to that row**. You can drag dice **between score rows** too. Drag back to rolling area to remove from score.
- **Sync**: changes go out on a **module socket**. The sender **also applies the change locally first** (Foundry does not echo your own emit).
- **Open**: scene controls button opens the app (`ApplicationV2` + Handlebars).

## Main files

- `scripts/virtual-table-app.js` — UI, drag/drop, selection, marquee.
- `scripts/state.js` — apply mutations (`applySocketMessage`), board shape.
- `scripts/shared-store.js` — holds shared state, `commitMutation`, socket listener.
- `scripts/foundry-rolls.js` — `await roll.evaluate()` for rolls (not sync evaluate).
- `scripts/permissions.js` — who may edit which board.
- `templates/virtual-table.hbs` — layout.
- `lang/en.json` — keys like `virtual-dice-table.rollNew` (full id in JSON).

## Board data (per player + GM private)

- `faces`, `tableDice[]`, `zoneRows[]` where each row is `{ id, dice[] }`.
- Old saves used flat `zoneDice`; `migrateBoard()` converts once.

## Socket messages (types)

`rollNew`, `startRoll`, `endRoll`, `rerollDieIds`, `moveDice`, `resetScore`, plus `syncFullState` / `requestFullSync` for GM full push.

`moveDice`: `to` is `"table"` or `"zone"`; for zone use `zoneNewRow` and/or `zoneRowId`.

## Sorting

New rolls and moves **sort** dice. **Rerolls do not** reorder dice (values update in place).

## UX notes

- Marquee + Ctrl/Cmd click to select. **Reroll selected** sits under the rolling grid when something is selected; selection **stays** after reroll.
- **Reroll all** (toolbar): rerolls everything still on the **rolling area** only (not score).
- **Double-click**: if that die is **selected**, reroll **all selected**; otherwise reroll **that die** only. Plain clicks use a short delay only when **multiple** dice are selected so double-click still works.
- **Reset board** runs with **no confirm**.
- Brief **CSS roll animation** on new values; `queueRollAnimation` + `vdt-die-rolling` class.

## Edits

Keep changes small and match existing patterns. Don’t rename `virtual-dice-table.*` lang keys without updating `en.json`.
