# FarkPG Web – AI context

Instructions for AI and developers working in this folder.

## Project and deploy

- This folder is the **FarkPG** static site: SvelteKit + `@sveltejs/adapter-static`, built for **GitHub Pages**.
- The site should include: **basic game rules** and **multiple character builders**.

## Game system (for context)

- **Farkle** is the core resolution mechanic (dice rolling).
- **Attributes + skills** determine how many dice are rolled for actions.
- **Abilities** are special traits characters can have.
- Design goal: **rules lite**, **flexible**.

## Character builder architecture

- **One core, many builders**: Shared builder logic should be **modular and reusable** so different “builder variants” can exist.
- **Per-builder flexibility** (via config/themes):
  - Which **attributes** and **skills** are offered (and how they’re grouped).
  - How **points** are allocated (e.g. separate pools for attributes, skill categories, abilities).
- Each character builder uses the same core but can differ in skills, attributes, and point allocation. Support **multiple builders** from one codebase.

## Code and structure

- **Formatting**: Keep code well formatted and clean.
- **Structure**: Prefer clear separation between core builder logic (e.g. in `src/lib/`) and builder-specific config/routes (e.g. theme data, route per builder if needed).

## Data and tooling

- **Structured, portable data**: Character and system data (attributes, skills, abilities, themes, point pools) should be **structured and portable**. There are plans to support **non–static-site tools** for FarkPG (e.g. other apps, scripts, or editors). Design schemas and file formats so the same data can be consumed by the web site and by other tools.

## Reference

- **docs/** is the **central info source** for how FarkPG is formatted. It holds:
  - **General game rules** (text explaining how the game works)
  - **System data** (definitions of attributes, skills, abilities, themes)
  - **Character schema** (structure of a character sheet / saved character)
  - **Creation rules** (how points are allocated and how character building works)
- **docs-old/** contains the legacy Jekyll/vanilla JS character builder and theme data (e.g. `docs-old/assets/js/themes/basic.js`). Use it for reference when porting data shapes; it will be removed once everything lives in the site.
