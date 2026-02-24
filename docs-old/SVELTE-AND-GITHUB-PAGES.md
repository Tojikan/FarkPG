# SvelteKit + GitHub Pages demo

This repo includes a small **SvelteKit** app (using the **static adapter**) and a **GitHub Actions** workflow that builds it and deploys to **GitHub Pages**. This doc explains how both work and how to run the demo.

References:

- **[Static site generation • SvelteKit Docs](https://svelte.dev/docs/kit/adapter-static)** — official GitHub Pages steps (we follow these and add GitHub Actions).
- [How to deploy a SvelteKit website to GitHub pages (Okupter)](https://www.okupter.com/blog/deploy-sveltekit-website-to-github-pages) — same adapter and base path; we deploy via **GitHub Actions** instead of the `gh-pages` branch.

## Quick start

1. **Run the SvelteKit app locally**
   ```bash
   cd web
   npm install
   npm run dev
   ```
   Open http://localhost:5173 and try the counter and name input.

2. **Enable GitHub Pages via Actions** (one-time)
   - Repo **Settings → Pages → Build and deployment**
   - Set **Source** to **GitHub Actions**

3. **Deploy**
   - Push to `main` (or run the workflow from the **Actions** tab). The site will be at `https://<username>.github.io/FarkPG/`.

## What’s in the repo

| Part | Purpose |
|------|--------|
| **`web/`** | SvelteKit app with `@sveltejs/adapter-static`. Simple demo: counter + name binding. |
| **`web/static/.nojekyll`** | Tells GitHub Pages not to process the site with Jekyll (see [adapter-static](https://svelte.dev/docs/kit/adapter-static)). |
| **`.github/workflows/deploy-pages.yml`** | Workflow that builds `web/` and deploys the `build/` output to GitHub Pages. |

The live site is served at **`https://<username>.github.io/<repo-name>/`** (project Pages). The app is built with `paths.base` set to the repo name so assets and routes work on that path.

---

## GitHub Pages steps (from adapter-static docs)

We follow the [GitHub Pages section](https://svelte.dev/docs/kit/adapter-static#github-pages) of the adapter-static docs:

1. **Set `config.kit.paths.base`**  
   When the repo name is not `your-username.github.io`, the site is served from `https://your-username.github.io/your-repo-name`. So we set `paths.base` to the repo name. The workflow sets `BASE_PATH: '/${{ github.event.repository.name }}'` and `svelte.config.js` reads `process.env.BASE_PATH` so it works for any repo.

2. **Generate a fallback `404.html`**  
   So GitHub Pages shows our app’s 404 instead of the default. In `svelte.config.js` we use `adapter-static` with **`fallback: '404.html'`**. The app has `src/routes/+error.svelte` to render a friendly 404 (and other errors).

3. **`.nojekyll` in `static/`**  
   An empty file at `web/static/.nojekyll` is included in the build so GitHub Pages doesn’t run Jekyll on the deployed files. (The docs say this is for when you’re not using GitHub Actions; we use Actions but still include it so the site is served as plain static files.)

---

## How SvelteKit works (quick tour)

- **Routes**: `web/src/routes/+page.svelte` is the home page; `+layout.svelte` wraps all pages and imports global CSS.
- **Static adapter**: All pages are prerendered at build time; output is static HTML/assets in `web/build/`.
- **Reactivity**: Same as Svelte (e.g. `count`, `name` in the demo).
- **Base path**: Set in `svelte.config.js` via `paths.base` (and `trailingSlash: 'always'` for clean URLs on Pages).

Try it locally:

```bash
cd web
npm install
npm run dev
```

Open http://localhost:5173. Edit `web/src/routes/+page.svelte` and save; the page updates without a full reload.

Build for production (same as CI):

```bash
cd web
npm run build
```

Output is in `web/build/`. For local testing with the same base path as GitHub Pages (replace `FarkPG` with your repo name if different):

```bash
BASE_PATH=/FarkPG npm run build
npm run preview
```

---

## How GitHub Pages works with this setup

We use a **custom GitHub Actions workflow** instead of “Deploy from a branch”, so we can build the SvelteKit app and then deploy the built files.

1. **Configure Pages to use Actions** (one-time, in the repo):
   - **Settings → Pages**
   - Under **Build and deployment**, **Source**: **GitHub Actions**

   See: [Configuring a publishing source for your GitHub Pages site](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site#publishing-with-a-custom-github-actions-workflow).

2. **What the workflow does** (on push to `main` or when you run it manually):
   - **build** job: checkout → install deps in `web/` → `npm run build` with `BASE_PATH: '/${{ github.event.repository.name }}'` (so `paths.base` matches the repo) → upload **`web/build`** as the Pages artifact.
   - **deploy** job: deploy that artifact to the `github-pages` environment.

3. **Result**: The contents of `web/build/` are served at `https://<username>.github.io/FarkPG/`.

The **`.nojekyll`** file in `web/static/` is copied into `build/` and tells GitHub Pages to serve the site as static files and not run Jekyll.

To add a lockfile for faster and more reproducible CI:

```bash
cd web && npm install && cd ..
# Commit web/package-lock.json
```

Then in `.github/workflows/deploy-pages.yml` you can change the install step to `npm ci` and add cache (e.g. `cache: 'npm'`, `cache-dependency-path: web/package-lock.json`) for faster installs.

---

## Summary

- **SvelteKit**: Static site in `web/` with adapter-static; run with `npm run dev` or `npm run build` + `npm run preview`.
- **GitHub Pages**: Source = **GitHub Actions**; the workflow builds the SvelteKit app and deploys `web/build/` to `https://<username>.github.io/FarkPG/`.
