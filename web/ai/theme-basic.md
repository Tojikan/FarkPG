# FarkPG – Basic theme (system reference)

This document defines the **basic** theme: a generic, multi-setting RPG configuration used by the default character builder. It uses **Fate** as the resource currency and the attribute set below.

## Attributes

| Id | Label | Abbr | Min | Max | Default |
|----|--------|------|-----|-----|---------|
| strength | Strength | STR | 1 | 6 | 2 |
| perception | Perception | PER | 1 | 6 | 2 |
| intelligence | Intelligence | INT | 1 | 6 | 2 |
| dexterity | Dexterity | DEX | 1 | 6 | 2 |
| endurance | Endurance | END | 1 | 6 | 3 |
| rizz | Rizz | RIZ | 1 | 6 | 2 |

## Health (from Endurance)

- **HP** is derived from **Endurance**. The theme specifies this in JSON via `healthFromAttribute`:
  - `attributeId`: the attribute that determines health (e.g. `"endurance"`).
  - `baseValue`: HP at the reference stat (e.g. `10000`).
  - `atStat`: the reference value (e.g. `3`).
  - `perPoint`: change in HP per point above/below the reference (e.g. `2000`).
- Formula: **HP max = baseValue + (Endurance − atStat) × perPoint**.
- For this system: **10000 HP at Endurance 3**, with **±2000** per point (Endurance 1 → 6000, Endurance 6 → 16000).

## Resource: Fate

- **Fate** is the resource currency for this theme. Characters have a Fate pool (current and max). Spending Fate allows protecting rolls or powering certain abilities (see [Game rules](game-rules.md)).
- Fate is tracked on the character sheet and can be restored by the GM (rest, milestones, etc.).

## Skill categories and skills

### Combat

- **Melee** (Strength) – Close-quarters weapons.
- **Ranged** (Dexterity) – Bows, guns, thrown weapons.
- **Block** (Strength) – Blocking with shield or weapon.
- **Defend** (Dexterity) – Dodging, parrying.
- **Throwing** (Dexterity) – Thrown weapons, grenades.

### Adventuring

- **Lockpick** (Dexterity)
- **Stealth** (Dexterity)
- **Athletics** (Strength)
- **Traps** (Perception) – Find and disarm traps.
- **Crafting** (Intelligence)
- **First Aid** (Intelligence)
- **Scavenging** (Perception)
- **Animal Handling** (Rizz)
- **Insight** (Perception)
- **Investigation** (Intelligence)
- **Sleight of Hand** (Dexterity)
- **Acrobatics** (Dexterity)

### Social

- **Persuasion** (Rizz)
- **Intimidation** (Strength or Rizz)
- **Deception** (Rizz)
- **Charm** (Rizz)

### Knowledge

- **Science** (Intelligence)
- **History** (Intelligence)
- **Streetwise** (Intelligence)
- **Religion** (Intelligence)
- **Politics** (Intelligence)
- **Nature** (Intelligence)
- **Survival** (Perception)

### General

- **Performance** (Rizz) – Acting, music, oration.
- **Piloting** (Dexterity) – Vehicles, mounts.
- **Lore** (Intelligence) – General knowledge, trivia.

## Point pools (creation)

- **Attribute points**: 18 (total to spread across the six attributes; defaults count as spent).
- **Skill points** (per category): Combat 12, Adventuring 18, Social 10, Knowledge 14, General 6.
- **Ability points**: 10.

(Exact numbers can be tuned; these are the default pool sizes for the basic theme.)

## Abilities

Abilities are bought with **ability points** at character creation. Each ability has a **cost** (in points) and a **usage** that may cost Fate or actions in play.

| Id | Label | Cost | Description / usage |
|----|--------|------|----------------------|
| extra-scoring-die | Extra Scoring Die | 2 | Spend 3 Fate: your next roll may count 50 points on one additional number (e.g. an extra 5 or 1). |
| double-down | Double Down | 3 | Spend 2 actions: your next Farkle roll has a 2× multiplier on the score. |
| fate-d20 | Fate D20 | 3 | Spend 3 Fate: roll a D20 on an action and add (roll × 100) to the result. |
| fate-reroll | Fate Reroll | 1 | Spend 1 Fate: reroll all dice once during a Farkle roll (before banking). |
| steady-hand | Steady Hand | 2 | Spend 1 Fate: ignore one farkle (no score, no bust) and keep one scoring combination from that throw. |
| burst | Burst | 2 | Spend 2 Fate: roll one extra die on your next action (max 6 dice total). |
| second-wind | Second Wind | 2 | Once per session: restore 2 Fate (cannot exceed max). |
| lucky | Lucky | 1 | When you farkle, spend 1 Fate to treat one die as a scoring die (your choice: 1 = 100, 5 = 50). |
| tactician | Tactician | 2 | Spend 1 action: an ally’s next roll this turn gains +1 die (max 6). |
| scavenger | Scavenger | 1 | When you use Scavenging, you may spend 1 Fate to treat the result as one tier better. |

(More abilities can be added; keep the same format: id, label, cost, description/usage.)

## Character schema (basic theme)

- **attributes**: Map of the six attribute ids to values (1–6).
- **skills**: Map of category id → skill id → value (plus custom skills per category if supported).
- **abilities**: Map of ability id → 1 (taken) or 0 (not taken); levelable abilities could use level.
- **points**: Pools used (attributes, skills per category, abilities).
- **fate**: `{ current, max }` for the Fate resource.
- **custom**: Custom skills/abilities as per [Character schema](character-schema.md).
