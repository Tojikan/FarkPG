# FarkPG Character Sheets App

Authenticated web app for creating, saving, and managing FarkPG character sheets across campaigns.

## Stack

- **SvelteKit 5** + Tailwind CSS 4
- **Supabase** (PostgreSQL + Auth + RLS)
- **Cloudflare Pages** (deployment)

## Setup

### 1. Supabase

1. Create a free project at [supabase.com](https://supabase.com).
2. Run the SQL in [`supabase/migrations/001_initial.sql`](supabase/migrations/001_initial.sql) via the SQL editor.
   If upgrading an existing database, also run [`002_campaign_delete.sql`](supabase/migrations/002_campaign_delete.sql), [`003_unassigned_characters.sql`](supabase/migrations/003_unassigned_characters.sql), and [`004_character_portraits.sql`](supabase/migrations/004_character_portraits.sql).
3. Copy the project URL and anon key from **Settings → API**.
4. Disable email confirmation for a small friends group (**Authentication → Providers → Email**) if you want instant signup.

### 2. Local development

```bash
cd app
cp .env.example .env
# Edit .env with your Supabase URL and anon key
npm install
npm run dev
```

### 3. Deploy to Cloudflare Pages

1. Create a Cloudflare Pages project linked to this repo.
2. Set build command: `npm run build`
3. Set build output directory: `.svelte-kit/cloudflare`
4. Set root directory: `app`
5. Add environment variables:
   - `PUBLIC_SUPABASE_URL`
   - `PUBLIC_SUPABASE_ANON_KEY`

Or use the GitHub Actions workflow in [`.github/workflows/deploy-app.yml`](../.github/workflows/deploy-app.yml) with repository secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `PUBLIC_SUPABASE_URL`
- `PUBLIC_SUPABASE_ANON_KEY`

## Features

- Email/password auth
- Multi-campaign support (create/join via invite code)
- Character sheets stored as JSONB (Basic, Neon City, ZnZ themes)
- GM tools: view/edit all sheets, item store, grant items to characters
