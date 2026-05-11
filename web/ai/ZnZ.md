# FarkPG ZnZ – Zombie ruleset context

This document describes **FarkPG ZnZ** (“zombies and zero” or zombie-themed FarkPG): what it is, how it relates to the wider FarkPG project, how it is meant to pair with **Foundry VTT**, and the **rules and content** another AI or developer needs to implement a web character builder, a Foundry system, or import/export between them.

For shared FarkPG concepts (Farkle resolution, general attributes/skills framing, portable data philosophy), see [Game rules](game-rules.md), [System data](system-data.md), [Character schema](character-schema.md), and [Creation rules](creation-rules.md). ZnZ is a **specific variant**: same family of ideas, different stat model, skill lists, creation flow, and presentation goals.

---

## What ZnZ is

- **Setting and tone**: A **zombie-survival** framing of FarkPG—rules-lite, flexible play, with character creation that emphasizes physical survival, expertise, and mental resilience under pressure.
- **Product surface**: A **dedicated character builder** on the FarkPG **static documentation / tools site** (`web/`), with its own **theme** (visual identity and copy appropriate to survival horror). The builder is not only documentation: it is the authoritative place many players will define a ZnZ character before play.
- **Virtual tabletop**: A **Foundry VTT system** (`farkpg-znz`) is under active development. The long-term intent is **round-trip alignment**: players build (or tweak) characters in the web builder, **export structured character data** (e.g. JSON), and the Foundry system **imports** that payload onto an actor sheet. The sheet remains the live play surface; the web builder is optimized for guided creation and sharing.

ZnZ is therefore a **cross-platform ruleset**: one mental model for attributes, skills, resources, and abilities, consumed by at least two clients (web builder, Foundry).

---

## Design goals that affect every implementation

1. **Guided creation**: Character creation is **step-by-step** (wizard-style), not one overwhelming form—name, then attributes, then one pass per attribute for skills, then abilities—before committing the character.
2. **Clear separation of “core” vs “add-on” skills**: **Core** skills are the fixed five per attribute (and match the Foundry system’s built-in skill keys). **Add-on** skills are optional extras defined for ZnZ (parkour, knowledges, etc.); players may also add **fully custom** skills. Core and add-ons should remain **visually and structurally distinct** so players and tools never confuse “system baseline” with “table or player extensions.”
3. **Export as contract**: Exported JSON should be designed as a **stable contract** for Foundry (and other tools): include a format or schema version, human-facing name, attributes, all skill ratings (core, add-on, custom), chosen ability, and enough metadata for a future importer to map into actor data without guesswork.
4. **Post-creation editing**: After creation, the **character sheet view** in the builder should still allow **editing all fields** (GM tweaks, progression, mistakes). Creation rules (point pools, one starting ability, etc.) apply during the wizard; the sheet is a flexible editor afterward.
5. **No silent data loss**: Actions that replace the current character (e.g. “Build new character”) should **warn** that existing data will be removed.

Exact formulas for max health, movement, and max AP from attribute scores may evolve in Foundry; the **conceptual bindings** below are the ruleset contract.

---

## Core stats: three attributes

ZnZ uses **three attributes** (not the six-stat “basic” FarkPG theme):

| Attribute | Meaning (short) | Drives (conceptual) |
|-----------|-----------------|---------------------|
| **Body** | Physical capability | **Maximum Health** |
| **Adroit** | Expertise and dexterity | **Movement Speed** |
| **Mind** | Mental and social capability | **Maximum Action Points (AP)** |

During the attribute step of the wizard, the player assigns or confirms attribute values. **Derived caps** (max health, movement, max AP) should be **shown** as read-only consequences of those attributes—not edited independently during creation—so players see the implications of their choices.

---

## Skills: structure and point rules

### Core skills (per attribute)

These are the **canonical five** under each attribute. They align with the Foundry system’s skill keys (see `ATTRIBUTE_SKILLS` in the `farkpg-znz` system: `body`, `adroit`, `mind` arrays). Descriptions for player-facing copy:

**Body** (physical capability; ties to max health)

- **Melee Weapons** – Skill with melee weaponry.
- **Block** – Block damage dealt in an area.
- **Unarmed** – Unarmed combat; unarmed attacks deal **0.5×** damage by default unless an ability changes this.
- **Endurance** – Resist physical damage and health conditions.
- **Athletics** – Swimming, climbing, and similar exertion.

**Adroit** (expertise and dexterity; ties to movement)

- **Ranged Weapons** – Skill with ranged weaponry.
- **Dodge** – Avoid damage for yourself only.
- **Throwing** – Thrown weapons and objects.
- **Coordination** – Hand-eye coordination and balance.
- **Stealth** – Avoid detection.

**Mind** (mental and social capability; ties to max AP)

- **Charisma** – Social skills.
- **Intelligence** – Smarts and capacity for learning.
- **Perception** – Senses and noticing important details.
- **Sanity** – Enduring psychological stress and damage.
- **Instinct** – Sensing impending danger.

### Skill point pools and escalating costs (ZnZ creation)

For **each** of the three attributes, during that attribute’s skill step:

- The player receives a pool of **2 × (number of core skills in that attribute)** points. With five core skills per attribute, that is **10 points per attribute** for spending **only** on skills grouped under that attribute (core + add-ons + custom that belong to that attribute, per tool rules).
- **Escalating cost**: Raising a skill from level *n* to *n+1* costs **(*n+1*)** points from that attribute’s pool (first point toward rating 1 costs 1, toward 2 costs 2, toward 3 costs 3, and so on). This applies in the same spirit to any skill line the rules allow to increase (core, designated add-ons, or custom), unless a future errata defines exceptions.

### Add-on skills (ZnZ-specific extras)

Add-ons are **not** part of the minimal Foundry core list but **are** part of the ZnZ ruleset experience on the web. They should be **separated** from core skills in the UI (section headers, dividers, or equivalent). Assign them to the same three attributes for pool purposes.

**Body add-ons**

- **Parkour** – Move through terrain efficiently.
- **Grapple** – Wrestle and restrain.
- **Cardio** – Reduce costs to move over long distances.

**Adroit add-ons**

- **Thievery** – Lockpicking, breaking and entering, hotwiring.
- **Crafting** – Craft and create items.
- **Sleight of Hand** – Tricks and sly manual actions.

**Mind add-ons**

- **Knowledges** – Specialized fields of expertise. Implementation expectation: present as a **dropdown** of predefined knowledge areas (e.g. Engineering, Construction, Medical, Science—with optional free-text to specify science subject—Computer, Farming, Firefighting, Foraging, Hunting, Vehicle Handling, Trap making, Investigation), plus room to **name or customize** the specific knowledge. Multiple knowledge lines can exist as separate add-on entries if the rules allow; the important part is **dropdown + customization** for clarity at the table.
- **Improvised Weaponry** – Use the environment as weapons or for environmental attacks.
- **Aura** – Intimidate or reliably draw attention when desired.

### Custom skills

Players may add **custom** skills beyond core and listed add-ons. Customs should:

- Be labeled and described by the player.
- Be assigned to **Body**, **Adroit**, or **Mind** for **which point pool** applies.
- Stay **grouped separately** from both core and preset add-ons in the UI so export and teaching stay clear.

Foundry today may store custom skills in a flexible map (e.g. `customSkills`); the export contract should carry enough structure for import without collapsing distinct entries.

---

## Abilities (starting package)

ZnZ uses a fixed menu of **starting abilities**. During creation, **each character chooses exactly one** from this list (unless future house rules say otherwise). Abilities combine **combat or utility effects** with some **starting gear or passive** benefits.

Player-facing list (names, costs where stated, and effects):

- **Snipe** – Costs **2 actions**. Your next ranged attack deals **2×** damage.
- **Shield Bash** – Costs **3 AP**. Your next block roll deals **half** the block value as damage.
- **Rampage** – Costs **4 AP**. Your next melee attack deals **3×** damage.
- **Maximum Effort** – Costs **4 AP**. Declare a number 1–6. Your next Farkroll treats that number as **50** (doubles it if it is **1** or **5**). Applies to **individual rolls** only.
- **Locked and Loaded** – Start with a **handgun** and **20 ammo** (no AP/action cost stated on the ability itself; treat as passive starting loadout unless errata adds a cost).
- **Bushwhack** – Start with a **melee weapon** of your choice.
- **Geared Up** – Start with a **backpack** and **basic travel kit**.
- **Martial Artist** – Your unarmed attacks deal **1×** damage instead of the default **0.5×**.
- **Stocked** – Start with **additional food and water**.

The web builder should record **which** ability was taken so export can create or equip the right Foundry items or notes.

---

## Relationship to Foundry (`farkpg-znz`)

The Foundry system is the **runtime sheet** for play: health, AP, movement, inventory, items (weapons, consumables, equipment, abilities as item types), and rolls.

Relevant facts for alignment (details will change as the system grows):

- **Actor template** includes `attributes.body|adroit|mind`, a flat map of **core** skills by camelCase keys, `customSkills`, resources (`health`, `actionPoints`, `movement`, etc.), and config slots.
- **System config** (`ATTRIBUTE_SKILLS`) is the single list of which camelCase keys belong to which attribute for UI and logic.

The **web export** should be explicit enough that an importer can:

1. Set name and biography text as appropriate.
2. Write the three attributes.
3. Map each known core skill key to the actor’s `skills` object.
4. Map add-on and custom skills into whatever structure Foundry uses for non-core skills (native fields, items, or flags—**importer and system agree on one approach**).
5. Set derived or base **health max**, **AP max**, and **movement** from attributes per the rules the system implements.
6. Represent the chosen **starting ability** (item, embedded ability record, or sheet field—product decision).

This document does not prescribe Foundry implementation details; it states **what the player-facing ruleset expects** so both sides can converge.

---

## Web builder UX expectations (summary)

These are **product** expectations, not layout specs:

- **Empty state**: Centered **Build character** (or equivalent); **no** full sheet until a character exists.
- **Wizard**: (1) Name → (2) Attributes, showing **derived** max health, movement, max AP as **read-only** → (3–5) One screen per attribute for spending that attribute’s skill points on core, add-ons, and customs (with separators and knowledge UI as above) → (6) Abilities: pick **one** → complete.
- **After creation**: Top summary (**name**, **max health**, **AP**, **movement**), then three columns or panels for **Body / Adroit / Mind** with core vs add-on vs custom grouping, then **abilities** section, **Export to clipboard** (JSON), **Build new character** (confirm discard), and **all fields remain editable**.

---

## For future AI: what to infer vs what to ask

- **Infer**: Three-attribute model; core five skills each; 10 points per attribute with escalating per-rank cost; one starting ability from the fixed list; separation of core / add-on / custom skills; export as the handoff to Foundry.
- **Ask or read from code** when implementing: exact formulas for health, movement, and AP from attribute numbers; maximum skill rating; whether add-ons have separate caps; how Foundry stores imported abilities and custom skills; schema version number and JSON field names once defined.

When in doubt, keep **player-visible rules** and **export clarity** aligned with this document and keep Foundry’s `template.json` / system config as the **live source of actor field names** for anything stored on the sheet.
