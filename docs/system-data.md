# FarkPG – System data

Definitions and structure for FarkPG system data. This is the format used by themes/builder configs and should be portable across the web site and other tools.

## Themes

A **theme** (builder config) defines:

- **Points**: How many points are available for attributes, each skill category, and abilities (see [Creation rules](creation-rules.md)).
- **Attributes**: List of attributes with `id`, `label`, `abbr`, `min`, `max`, `default`.
- **Skills**: Grouped by category. Each category has `label`, optional `alwaysDisplay`, `max` (per-skill cap), and a list of skills. Each skill has `id`, `label`, optional `attribute` (link to attribute id), optional `description`.
- **Abilities**: List of abilities with `id`, `label`, `cost`, optional `levelable`, optional `maxLevel`, `description`.
- **Health** (optional): e.g. `max` for health tracking.

## Data format

Use a **portable, tool-friendly format** (e.g. JSON or YAML) so the same files can be used by the web app and by scripts/other tools. Avoid format choices that tie data to a single runtime (e.g. raw JS theme objects only).

## Example shape

Reference implementation and example shapes live in `docs-old/assets/js/themes/basic.js`. When porting to the new site, align to the structures described above and keep a canonical form in this repo (e.g. under `docs/` or a shared data path) so all tools consume the same definitions.
