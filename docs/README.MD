# FarkPG – Central info source

This folder is the **single source of truth** for how FarkPG is formatted and defined. Use it when building the web site, tools, or any other consumer of FarkPG data.

## Contents

| Document | Purpose |
|----------|---------|
| [Game rules](game-rules.md) | General rules: how the game works, Farkle resolution, attributes + skills, abilities. |
| [System data](system-data.md) | Definitions of attributes, skills, abilities, themes, and point pools. Structure and format for system/builder config. |
| [Character schema](character-schema.md) | Structure of a character sheet and saved character data (export/import). |
| [Creation rules](creation-rules.md) | How character building works: point allocation, limits, and builder flow. |

## Data portability

Character and system data are designed to be **structured and portable**. The same schemas and formats should be usable by:

- The static web site (e.g. `web/`)
- Other tools (apps, scripts, editors) that may be added later

Keep definitions here so all consumers stay aligned.
