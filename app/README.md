# RPG Character App

GM campaign management with code-based player access. GMs log in, create campaigns from a
setting (The Last Empire, Zombie), and share a 6-character campaign code. Players join with
that code — no account — create a character through a setting-driven wizard, and get an
8-character character code that opens their live-updating sheet from any device.

## Stack

- SvelteKit 5 + Tailwind 4, deployed to Cloudflare Pages (`@sveltejs/adapter-cloudflare`)
- Supabase: Postgres + Auth (GM only) + Storage (portraits) + Realtime (sheet sync)
- Settings are plain JSON in `src/lib/settings/` — attributes, skills, abilities, backgrounds,
  item templates, and creation rules are all data

## Access model

- **GM**: email/password login. Accounts are created manually in the Supabase dashboard
  (Authentication → Users → Add user) — there is no signup flow. RLS gives GMs full access
  to their own campaigns.
- **Player**: no login. All player reads/writes go through security-definer RPC functions
  that validate `campaign_code` + `character_code` on every call. The anon key cannot read
  tables directly. Codes are cached in localStorage so returning players skip re-entry.

## Setup

### 1. Database

Open the Supabase SQL editor and run, in order:

1. **`supabase/migrations/000_reset.sql`** — ⚠️ **only if this project previously ran the old
   FarkPG sheets app.** It drops the old tables (`profiles`, `campaign_members`, …) and all
   their data. Skip on a fresh project.
2. **`supabase/migrations/001_initial.sql`** — creates tables, RLS, RPC functions, and the
   `character-images` storage bucket.

### 2. GM account

Supabase dashboard → Authentication → Users → **Add user** (email + password, confirm email).
Every user is a GM; they only ever see their own campaigns.

### 3. Environment

```sh
cp .env.example .env
# PUBLIC_SUPABASE_URL=https://your-project.supabase.co
# PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 4. Run locally

```sh
npm install
npm run dev
```

## Deploy (Cloudflare Pages)

`wrangler.toml` already points Pages at `.svelte-kit/cloudflare`.

1. Connect the repo in the Cloudflare dashboard (root directory `app/`), build command
   `npm run build`.
2. Set `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_ANON_KEY` as build environment variables.
3. Deploy. Share `https://<your-pages-domain>/join` with players.

## Routes

| Route | Who | Purpose |
|---|---|---|
| `/login` | GM | Email/password login (no signup) |
| `/` | GM | Dashboard: campaign list + create |
| `/campaign/[id]` | GM | Roster, codes, notes, campaign settings |
| `/campaign/[id]/items` | GM | Item generator (Tab/Enter rapid entry) |
| `/campaign/[id]/character/[charId]` | GM | Character sheet with drag-and-drop item panel |
| `/join` | Player | Enter campaign code; reopen saved characters |
| `/join/[code]/create` | Player | Multi-step creation wizard |
| `/sheet/[campaignCode]/[characterCode]` | Player | Live character sheet |

## Adding a setting

1. Create `src/lib/settings/<id>.json` following `src/lib/settings/types.ts`
   (`last-empire.json` is the reference).
2. Register it in `src/lib/settings/index.ts`.
3. Optionally add a `[data-setting='<id>']` theme block in `src/app.css`.
