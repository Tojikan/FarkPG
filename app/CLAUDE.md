# RPG Character App – AI context

Instructions for AI and developers working in this folder. This is the **campaign/character
app** of the monorepo; it does not share code with [`../web/`](../web/) (static rules site) or
[`../foundry/`](../foundry/).

## Purpose

GMs (Supabase email/password login, accounts created manually — **no signup route**) create
campaigns and manage an item list. Players join **without accounts** using a 6-char campaign
code, build a character in a wizard, and get an 8-char character code that opens their sheet.
Audience is a small group of friends: keep the schema thin and prefer free-tier hosting.

## Stack

- SvelteKit 5 (runes: `$state`, `$derived`, `$props`, `$effect`) + Tailwind 4
- `@sveltejs/adapter-cloudflare` → Cloudflare Pages (`wrangler.toml`, output `.svelte-kit/cloudflare`)
- Supabase Postgres + Auth + Storage + Realtime; env vars `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`

## Access model (important)

- **GM path**: `hooks.server.ts` (`@supabase/ssr`) guards everything except `/login`, `/join`,
  `/sheet`. GM pages use server loads / form actions with `locals.supabase`; RLS scopes rows
  to `gm_id = auth.uid()`.
- **Player path**: browser anon client → **security-definer RPCs only**
  (`join_campaign`, `create_character`, `load_character`, `save_character`,
  `list_campaign_items`). Every RPC re-validates `campaign_code` + `character_code`.
  Never add anon RLS policies on the tables; add/extend RPCs instead.

## Data model

`supabase/migrations/001_initial.sql` is the source of truth (000_reset.sql only clears the
pre-rebuild schema).

- `campaigns` — `gm_id`, `name`, `setting_id`, `campaign_code`, `max_characters`,
  `config_overrides jsonb`, `notes`
- `characters` — `campaign_id`, `name`, `player_name`, `image_path`, `character_code`,
  **`data jsonb`**, `deleted_at` (soft delete)
- `items` — `campaign_id`, `name`, `description`, `data jsonb` (per-setting fields)

Character attributes/skills/resources/abilities/inventory/notes all live in `characters.data`
(shape: `CharacterData` in `src/lib/character.ts`). Items are **copied** into inventory on add
(snapshot, no join table). Storage bucket `character-images` holds portraits.

## Setting engine

Settings are JSON in `src/lib/settings/` (`last-empire.json`, `zombie.json`), typed by
`types.ts`, validated + registered in `index.ts`. Numeric rules are parameterized formulas
(`formulas.ts`), point-buy math is in `costs.ts`. Per-setting CSS themes live in `src/app.css`
under `[data-setting='<id>']`. **Render everything from the setting definition — never
hardcode attribute/skill/ability lists in components.**

Behavior flags per setting: `allowCustomSkills`, `allowCustomAbilities`,
`playersCanAddAbilities`. Last Empire: escalating attribute costs, one-time refund for
dropping below start, health = 10000 + (Body − 6) × 1000, six fixed magic abilities.
Zombie: flat pools, pick-N perks, everything customizable.

## Key files

| File | Purpose |
|---|---|
| `supabase/migrations/001_initial.sql` | Schema, RLS, RPCs, storage — edit here for DB changes |
| `src/lib/settings/` | Setting JSONs + types + loader + cost/formula math |
| `src/lib/character.ts` | `CharacterData`, `createEmptyData`, `syncDerived`, `normalizeData` |
| `src/lib/components/Sheet.svelte` | Shared sheet (GM + player modes, autosave, realtime, DnD) |
| `src/lib/realtime.ts` | Broadcast channel per character (`character:{id}`) |
| `src/lib/playerCodes.ts` | localStorage persistence of player codes |
| `src/hooks.server.ts` | Supabase SSR + GM auth guard |

## Conventions

- Always run `syncDerived()` before persisting character data (recomputes resource maxima).
- Player pages (`/join`, `/sheet`) are `ssr = false`; GM pages use server loads.
- Saves are debounced (~600 ms) and broadcast `saved` on the character channel; other clients
  refetch (never table-level realtime — anon can't subscribe to it).
- Minimal scope: small diffs, no unrelated refactors.
