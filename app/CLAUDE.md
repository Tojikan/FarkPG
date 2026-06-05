# FarkPG Character Sheets App – AI context
Instructions for AI and developers working in this folder.
## Purpose
This folder is the **authenticated character sheets app** for FarkPG: players create and save character sheets to a database; GMs manage campaigns, edit any sheet, and maintain an item store.
It complements but does **not replace** the static site in [`../web/`](../web/) (rules + offline builders on GitHub Pages) or Foundry packages in [`../foundry/`](../foundry/).
**Audience:** a small group of friends. Keep the stack and schema simple; prefer free-tier hosting.
## Stack
| Layer | Choice | Notes |
|-------|--------|-------|
| Frontend | SvelteKit 5 + Tailwind 4 | Same stack as `web/` for familiarity |
| Adapter | `@sveltejs/adapter-cloudflare` | Deploy to Cloudflare Pages |
| Backend | **Supabase** (PostgreSQL + Auth + RLS) | No custom API server; app talks to Supabase directly |
| CI | [`.github/workflows/deploy-app.yml`](../.github/workflows/deploy-app.yml) | Builds on push to `main` when `app/**` changes |
**Env vars (required):**
- `PUBLIC_SUPABASE_URL`
- `PUBLIC_SUPABASE_ANON_KEY`
Copy from `.env.example` for local dev. RLS protects data; the anon key is safe in the frontend.
## Game system (brief)
FarkPG is a **rules-lite, flexible** tabletop RPG. See [`../web/ai/`](../web/ai/) for canonical rules and schemas.
│                   └── grant/     # grant item → character inventory
└── supabase/migrations/         # SQL schema + RLS (source of truth for DB)
```
**Auth flow:** `@supabase/ssr` in `hooks.server.ts` refreshes session cookies. Routes under `/campaigns` require login.
**Save flow:** `SheetEditor` debounces edits (~600ms) → `POST …/characters/[charId]/save` → merges with existing JSON, syncs derived stats, updates Supabase.
## Data model
### Relational tables (thin — identity + access control only)
Defined in [`supabase/migrations/001_initial.sql`](supabase/migrations/001_initial.sql):
- `profiles` — extends `auth.users`; auto-created on signup
- `campaigns` — `name`, `invite_code`, `created_by`
- `campaign_members` — `(campaign_id, user_id, role)` where `role` is `gm` | `player`
- `characters` — `campaign_id`, `owner_id`, `theme_id`, `name`, **`data jsonb`**
- `items` — `campaign_id`, `name`, **`data jsonb`**, `created_by`
RPC helpers (security definer):
- `create_campaign(name, invite_code)` — inserts campaign + adds caller as GM
- `join_campaign(invite_code)` — adds caller as player
Access helpers used in RLS:
- `is_campaign_member(campaign_id)`
- `is_campaign_gm(campaign_id)`
### JSON documents (flexible — rules evolve here)
- **Promote player to GM**
- **Import helper** — one-time migration from `localStorage` / clipboard export
- **Shared package** — extract types/themes into `packages/farkpg-core`
When extending the sheet editor, prefer extending `SheetEditor.svelte` and theme config over one-off route logic.
## Code conventions
- **Svelte 5 runes** (`$state`, `$effect`, `$props`, `$derived`)
- **Server loads** use `locals.supabase` and `locals.user` (never trust client for auth)
- **Minimal scope** — small diffs; don't refactor unrelated code
- **Theme-driven UI** — render attributes/skills from `Theme`, not hardcoded lists
- **Derived stats** — always run `syncDerivedStats()` before persisting (health max, fate/luck max, ZnZ movement/AP)
## Key files
| File | Purpose |
|------|---------|
| `supabase/migrations/001_initial.sql` | DB schema + RLS — edit here for schema changes |
| `src/lib/data/types.ts` | TypeScript types for themes, character JSON, items |
| `src/lib/data/character.ts` | `createEmptyCharacterData`, `mergeCharacterData`, `syncDerivedStats` |
| `src/lib/components/SheetEditor.svelte` | Main editable sheet UI |
| `src/hooks.server.ts` | Supabase SSR + protected routes |
| `README.md` | Human setup/deploy instructions |
## Deploy checklist
1. Run migration SQL in Supabase SQL editor
2. Set `PUBLIC_SUPABASE_*` in Cloudflare Pages (or GitHub Actions secrets)
3. Deploy; note Pages URL
4. Set `SHEETS_APP_URL` in [`../web/src/lib/sheetsApp.ts`](../web/src/lib/sheetsApp.ts) so the static site nav links here
## Risks
- **Rules change often** → keep bodies in JSONB; thin relational schema; preserve unknown keys
- **Supabase free tier pauses after 7 days inactive** → periodic use or upgrade if needed
- **Theme duplication vs `web/`** → sync manually until shared package exists