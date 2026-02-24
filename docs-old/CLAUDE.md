# FarkPG Character Builder - AI Instructions

This document provides instructions for AI assistants to generate and maintain the character builder system.

## Project Overview

FarkPG is a character sheet builder for a custom tabletop RPG system. The system is data-driven and theme-based, allowing different rule sets to be loaded.

## Technology Stack

- **Jekyll** - Static site generator
- **Pure JavaScript** - No frameworks, vanilla JS only
- **JSON** - Character data export/import format
- **HTML/CSS** - UI rendering

Rendered on github pages

---

## Data

The character sheet consists of the following data types:

- **Skills** - Has multiple categories of skills
- **Attributes** - Core character stats
- **Abilities** - Special abilities/powers
- **Points** - How many points allocated to Attributes, Abilities, and each Skill category
- **Health** - Current health tracking

---

## Themes

- A **theme** is a set of Skills/Attributes/Abilities/Points list. Basically lets us create numerous character building rules per special theme.
- We'll have hardcoded `theme.js` files that export out the skills/attributes/abilities inside a namespaced value.
- Themes define what options are available, but saved characters can contain values not in the current theme (for cross-compatibility).

---

## For Each Array

- Generate inputs for each section where you display the option and allow input of a value
- Be able to save those inputs into some sort of data that can be exported and imported in and out of the builder

---

## Save Data

- **Save a character into JSON** - Basically arrays of skills, attributes, abilities, max points available. It can be cross-compatible even if there's a value in there that is not in the theme.
- **Custom fields** - There needs to be a way for users to come up with a custom skill in each skill category or ability. Custom skills can be saved into the JSON and will render even if it's not included in the theme.
- **Max points** - Also needs to be editable but it should be a bit more hidden, like not an active looking input.

---

## Rendering

- **First load** - Should show empty sheet and fields are uneditable upon loading in.
- **Sections** - Everything should display as sections
- **Builder mode** - Builder mode opens a new modal or some sort of alternate screen where you are able to spread points around each skill.
- **Point distribution** - Builder mode spreads points around. There are separate points for attributes, each skill category, and abilities. Need to render points.
- **Custom skills** - Each skill category needs to have an ability to add custom skills.

---

## Health

- Health is interesting in that it should be saved and editable
- But it should always be editable, even without builder mode
- It should be able to be reset easily with a click
- Basically it's more for user convenience than a part of the sheet building

---

## Display

- Should be mobile friendly
- Clear visual hierarchy for sections
- Accessible and easy to use on touch devices
