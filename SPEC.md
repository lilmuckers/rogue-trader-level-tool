# Rogue Trader Build Tracker — Specification

## 1. Overview

A single-page, offline-capable web application that displays level-by-level
build progression for a player's chosen Main Character (MC) build and a
selected variant for each companion in *Warhammer 40,000: Rogue Trader*
(Owlcat Games). The intended use is mid-session reference on a phone: the
player advances a level counter and the app shows what to take for every
character at that level, with on-demand description text and a per-character
build timeline.

The app is built as a static Progressive Web App (PWA) suitable for hosting
on GitHub Pages and installation to an iOS home screen for fully offline use.

### 1.1 Source Material

Build data is derived from
[Revan619's Community Rogue Trader Unfair Builds & Resources](https://docs.google.com/spreadsheets/d/1rskX4sYcNm6Wqt4rtm8EQqRR4__yrEuxCEzjwoKlHOY/),
specifically the `Revan619 1.5 Builds`, `Revan619 1.5 Companion Builds`,
`Talents`, and `Abilities` sheets (game patch 1.5, including DLC).

### 1.2 Goals

- Eliminate context-switching to a Google Sheet during play.
- Work fully offline once installed.
- Persist user choices across sessions on the device.
- Render legibly on a small phone screen with one-handed use.
- Reflect party-availability state: only show picks for companions the
  player has actually recruited at their current level.
- Surface mechanical descriptions for picks on demand.
- Allow review of the full level-up plan for a single character (e.g. when
  catching a freshly-joined companion up multiple levels at once).

### 1.3 Non-goals

- Editing or contributing builds back to the source spreadsheet.
- Multi-device sync. Storage is per-device.
- Coverage of older patch versions (1.2, 1.3, 1.4) or non-Revan619 build
  authors.
- *Searchable* talent / ability database. Descriptions are surfaced
  contextually from picks, not browsable on their own.
- Bundling official character portrait artwork. Portraits are user-supplied.
- Respec workflow.

---

## 2. Domain Model

### 2.1 Build

A Build represents a complete level 1–55 progression plan for a single
character.

| Field | Type | Notes |
|---|---|---|
| `name` | string | Human-readable build name. |
| `theme` | string | MC builds only. Groups variants. |
| `origin` | string | MC builds only. Free-text origin/archetype/stat description. |
| `levels` | map<int, LevelEntry> | Keyed by level number, 1–55 inclusive. |

### 2.2 LevelEntry

The pick(s) the player should take when leveling up to the keyed level.

| Field | Type | Notes |
|---|---|---|
| `m` | string \| null | "Main" pick — primary ability, talent, stat, skill, or heroic action. |
| `e` | string \| null | "Extra" pick — second pick at the same level. May be absent. |

A pick string may contain multiple alternatives separated by `/`
(e.g. `"Commerce / Lore Imperium"` — meaning "either of these").
The lookup logic (§2.7) handles each alternative independently.

### 2.3 Companion

A Companion has a fixed identity, 1–N variants (each a Build), and a
fixed displayed archetype.

The 15 supported companions and archetypes:

| Companion | Archetype | Variants | Default Join Level |
|---|---|---|---|
| Abelard | Warrior | 5 | 1 |
| Idira | Operative | 3 | 1 |
| Argenta | Soldier | 3 | 3 |
| Pasqal | Operative | 7 | 6 |
| Cassia | Officer | 2 | 10 |
| Heinrix | Warrior | 6 | 12 |
| Yrliet | Operative | 3 | 14 |
| Jae | Officer | 3 | 16 |
| Ulfar | Soldier | 3 | 22 |
| Marazhai | Warrior | 2 | 31 |
| Kibellah | Bladedancer | 3 | 33 |
| Solomorne | Soldier | 1 | 37 |
| Incendia Chorda (DLC) | Soldier | 1 | 40 |
| Calligos Winterscale (DLC) | Warrior | 1 | 40 |
| Uralon (DLC) | Officer | 1 | 40 |

Default join levels are user-configurable per-companion in Setup.

### 2.4 MC Themes

11 themes containing 65 builds total: Commissar, Astra Militarum Commander,
Imperial Navy Officer, Ministorum Priest, Noble, Crimelord, Arbitrator,
Sanctioned Psyker (Offensive), Sanctioned Psyker (Support), Mixed/Specialty,
Navigator/Psyker Hybrid.

### 2.5 Configuration

```
{
  mc: { theme: string, buildIndex: int },
  companions: { [companionName: string]: int },
  joinLevels: { [companionName: string]: int }
}
```

Indices are zero-based into variants arrays. Join levels clamped to `[1, 55]`.

### 2.6 Level State

Integer in `[1, 55]`, persisted independently of configuration.

### 2.7 Definitions & Lookup

The bundled data includes three description tables:

| Table | Source | Approx. Entries |
|---|---|---|
| `talents` | `Talents` sheet, name in col A, description in col B | ~659 |
| `abilities` | `Abilities` sheet (with smart parsing of archetype-headline rows where the *first* ability of an archetype is encoded as `Name: description...` in the description cell) | ~137 |
| `heroic` | Hardcoded supplement covering Heroic Actions and a few high-frequency picks missing from the source sheet (Charge, Tactical Advantage, Versatility, etc.) | ~33 |

The runtime `lookupPick(rawPick)` resolves a build's pick string to zero
or more description records:

1. Split on `/` to handle alternative picks.
2. For each part, attempt lookup against a unified normalized index
   (priority: heroic > abilities > talents). Normalization includes:
   - Lowercase, whitespace collapse, punctuation strip.
   - Inline correction of known typos in the source data (`Tacticical`,
     `Eagar`, `Devestating`, `Versitility`, `Camraderie`, etc.).
3. If that fails, try variants: trailing roman-numeral upgrade tier
   stripped (e.g. `Daring Breach IV` → `Daring Breach`), `Characteristic
   Training:` prefix stripped, trailing punctuation stripped.
4. Picks classified as **skill or stat allocations** (Agility, Ballistic
   Skill, AP +1, etc.) are not looked up; they're labelled as such in the
   description sheet without further detail.

Coverage on real build data: ~89% of lookup-eligible picks resolve to a
description. Misses fall through gracefully — the UI shows "No description
available" rather than failing.

### 2.8 Portraits

Each character has an optional portrait image URL configured in a
`PORTRAITS` constant in `index.html`. Null or failed loads fall back to
a gothic two-letter initial badge.

---

## 3. User Interface

### 3.1 Views

Three views, swapped by visibility (no routing):
1. **Setup** — initial configuration / editing.
2. **Tracker** — primary in-play view.
3. **Bottom Sheet** — contextual overlay, two modes (description /
   catch-up timeline). Renders over the Tracker.

### 3.1.1 Setup View

- MC theme + build cascading dropdowns.
- One row per companion: variant dropdown + numeric `Joins @` input.
- Confirm / Cancel / Reset All Data buttons.
- Pre-populated with sensible defaults on first launch.

### 3.1.2 Tracker View

- Header with title.
- Action row: Edit Roster, Jump ▸ Lvl.
- Level Pane: large central level number, `−` / `+` buttons, tap-to-jump.
- Roster: MC card first (red accent), then "Retinue" divider, then
  companion cards in canonical order.
- Footer hint: `tap a card for descriptions · long-press for full timeline`.
- Footer flavour line.

### 3.1.3 Character Card

Horizontal layout: portrait (left, 56×56 circle), body (right).

Body shows: name, archetype, build name, and either:
- **Pick block** (available + has pick): `m` in gold, optional `e` below.
  Pick text gets a subtle ⓘ indicator if a description is available.
- **No-pick placeholder** (available + no pick): italic "— no pick at
  this level —", card dimmed to ~60%.
- **Unavailable tag** (level < join level): `⛓ Joins at level N`,
  card dimmed to ~42%, portrait greyscaled, pick text hidden.

Cards are interactive:
- **Short tap** → opens Description Sheet for the current level's picks.
- **Long-press** (≥480 ms, with movement-cancel and haptic feedback if
  available) → opens Catch-Up Timeline for the character's full build.

### 3.1.4 Bottom Sheet

A modal slide-up sheet from the bottom of the viewport, with:
- Drag-handle "grabber" at the top.
- Header: title + close button (×).
- Scrollable body (`overflow-y: auto`, `-webkit-overflow-scrolling: touch`).
- Backdrop overlay with blur, dismissable on tap.
- Swipe-down-to-close gesture: when the body is scrolled to top, dragging
  down translates the sheet; release with > 80px drag closes it.
- ESC key dismisses on desktop.
- Sheet locks body scroll while open.
- Max height 85vh; respects iOS safe-area inset at the bottom.

**Description Sheet content:**
- Header: `Level N · {Character}`.
- Context line: `Picks for {Character} at level N`.
- One block per resolved pick:
  - Resolved name (Cinzel display) — annotated with `— {raw pick}`
    if the match was via stripped tier (e.g. `Daring Breach — Daring Breach IV`).
  - Source label (mono caps): `Talent`, `Ability`, or `Heroic Action`.
  - Description text (Garamond body).
- Picks split on `/` are rendered as separate blocks (one per resolved
  alternative), so `"Commerce / Lore Imperium"` becomes two blocks.
- Skill/stat allocations show a "Skill / Stat allocation" label with
  no body text.
- Unknown picks show "No description available in the source data."

**Catch-Up Timeline content:**
- Header: `{Character} · Build Timeline`.
- Meta block: build name (italic) + archetype (mono caps).
- Timeline list, levels 1–55. Each row with content shows:
  - Level number badge (left, 38px wide).
  - Pick text (right): `m` in gold, optional `e` below in italic.
  - The current level row is highlighted with a gradient stripe and
    `NOW` tag instead of `LVL`.
  - Pick text with available descriptions is tappable and opens a
    nested Description Sheet for that single pick.
- Levels with no picks are skipped to keep the timeline dense.

### 3.2 Visual Design

Gothic-imperial: `#0a0908` bg, gold accents (`#c9a44c`, `#e8c468`),
blood-red (`#8b1a1a`) reserved for the MC.

Typography:
- **Cinzel** — headings, level number, character names, archetype labels,
  fallback initials.
- **EB Garamond** — pick text, description body, italic flavour.
- **JetBrains Mono** — archetype tags, join-level inputs, source labels.

### 3.3 Touch & Input

- 56×56 px tap targets for level controls.
- `touch-action: manipulation` everywhere.
- Card long-press cancels on > 10px movement.
- iOS context menu suppressed on cards (`contextmenu` event prevented).
- Cards animate slightly (`scale(0.99)` + box-shadow) when held.

---

## 4. Persistence

`localStorage` only.

| Key | Notes |
|---|---|
| `rt.config.v2` | Configuration (§2.5) |
| `rt.level.v1` | Current level integer |

One-shot silent migration from v1 to v2 fills `joinLevels` with §2.3
defaults. `Store` abstraction falls back to in-memory if `localStorage`
is unavailable (Claude.ai sandbox, Safari Private mode).

---

## 5. PWA Behaviour

### 5.1 Manifest

`manifest.json`: standalone display, portrait orientation, relative paths
(`./`), gold-on-dark theme, icons at 192/512 plus 512 maskable.

### 5.2 Service Worker

`sw.js` implements:
- **Install**: pre-caches app shell.
- **Activate**: deletes stale caches not matching `CACHE_VERSION`.
- **Fetch**:
  - HTML / navigations → cache-first, network fallback, `index.html` final.
  - Google Fonts → stale-while-revalidate.
  - Other GETs (icons, portrait images) → cache-first, network fallback,
    cache on success. Portrait URLs are cached opportunistically.

### 5.3 Update Strategy

Bump `CACHE_VERSION` after any change. Reloading once online picks up
the new version.

---

## 6. Data Pipeline

Build and definition data is **embedded as a JavaScript constant** in
`index.html`. No XHR at runtime.

### 6.1 Build Extraction

The source build sheets use a tile layout (24-row blocks vertically,
13-column variants horizontally). Within a variant, levels 1–15 / 16–35 /
36–55 sit in three column groups of `(label, main, extra)`. The Python
extraction script parses level labels (`"Level N :"`) and emits a JSON
document keyed by level.

Compact LevelEntry shape `{m, e}` minimises payload. URLs in build
names are stripped.

### 6.2 Definitions Extraction

The `Talents` sheet has a simple `(name, description)` per row.
The `Abilities` sheet uses the same layout *except* archetype-header
rows (e.g. `Warrior`, `Officer`) encode the first ability of that
archetype inside the description cell as `Name: description...`. The
extractor detects this pattern (regex match for `^[A-Z][A-Za-z...]+:
\s+`) and stores under the embedded name rather than the section header.

A small **hardcoded supplement** (`heroic`) covers picks that are
genuinely missing from the source sheet — primarily Heroic Actions
(Daring Breach, Finest Hour, Firearm Mastery, Dismantling, Death Waltz)
and a handful of common-action / Master-Tactician picks. These are
written by hand based on game knowledge to maximize lookup coverage.

### 6.3 Re-extraction Workflow

If the source sheet updates:
1. Re-download as `.xlsx`.
2. Run the extraction script to produce new combined JSON
   (`{mc_builds, companions, definitions: {talents, abilities, heroic}}`).
3. Replace the `const DATA = {...}` line in `index.html`.
4. Bump `CACHE_VERSION` in `sw.js`.
5. Commit and push.

The bundle currently weighs ~420 KB minified (~470 KB after embedding
in HTML).

---

## 7. File Layout

```
/
├── index.html              — App + embedded data + inline CSS & JS + PORTRAITS map
├── manifest.json           — PWA manifest
├── sw.js                   — Service worker
├── icon-{16,32,180,192,512,512-maskable}.png
├── README.md               — Deployment instructions
└── SPEC.md                 — This document
```

All paths are relative; works under any GitHub Pages project URL.

---

## 8. Deployment

GitHub Pages, Settings → Pages → Deploy from branch → main / root. HTTPS
required for service worker.

iOS install: open URL in **Safari**, Share → Add to Home Screen, launch
once online to populate caches, then app works offline.

---

## 9. Constraints & Assumptions

- Single-user, single-device. No accounts, no sync, no backend.
- Build data is a **point-in-time snapshot**; updates require redeploy.
- Targets modern mobile Safari (iOS 16+) and modern Chromium. ES2020+.
- Max level 55 (in-game cap with current DLC).
- Portrait URLs are user-supplied and may break over time. Fallback
  initial badge ensures graceful degradation.
- Default join levels are approximations of typical playthrough pacing.
- Definition lookup coverage is ~89% on real build picks. Misses are
  handled gracefully but not hidden — the user sees "No description
  available" rather than no UI feedback.
- The hardcoded `heroic` supplement table is best-effort game knowledge,
  not authoritative source data. It can be edited freely in `index.html`.
- Source spreadsheet structure is assumed stable. Major reorganisation by
  Revan619 will require updating the extraction script.


---

## 10. Version 5 Additions

### 10.1 Archetype Callouts (L16 / L36)

Each build records its three chosen archetypes (tier 1 / 2 / 3) directly
in the source spreadsheet's "Talent" header row, in the columns above
each level group:

- Column `base_col` → tier-1 archetype (active L1-15)
- Column `base_col + 3` → tier-2 archetype (chosen at L16, active L16-35)
- Column `base_col + 6` → tier-3 archetype (chosen at L36, active L36-55)

These are extracted into `DATA.archetypes.{mc,comp}[buildName] = {t1, t2, t3}`
during build, and looked up by name at runtime via `getBuildArchetypes()`.

When the current level is 16 or 36, character cards, the description sheet,
and the catch-up timeline all render an inline callout below the pick text:

> ⚜ Tier 2 archetype · Master Tactician

The catch-up header additionally shows the **full archetype path** for the
build as three pill-bordered tags joined by arrows:

> Officer → Master Tactician → Exemplar

so the player can see the whole arc at a glance.

Coverage is **100% of source builds** (64 MC + 44 companion variants).
Where the source row has an empty cell (some flavor / unfinished builds
in the source sheet), no callout appears for that tier.

#### Layout-shift edge case

For a small number of builds (mostly Ministorum Priest variants) the
source sheet has no separate name row above the origin, so the level
data starts one row earlier. The extractor detects this by checking
whether `block_start + 2` contains a tier-1 archetype name (Officer,
Warrior, Soldier, Operative, Bladedancer); if not, it falls back to
`block_start + 1`.

### 10.2 Skills & Gear Panels in Catch-Up

Each build's "Skill Options" and "Gear to Consider" sections from the
source spreadsheet are extracted alongside the level data. They appear at
the bottom of the catch-up timeline as two visually-distinct panels:

- **Skill Options** — a single Garamond paragraph of the recommended
  skill allocations.
- **Gear to Consider** — one row per slot (Helm, Armour, Cloak, Neck,
  Accessory 1/2, Gloves, Boots, Weapon Set 1/2, Pet for psyker
  companions). Each slot's options are rendered as gold-bordered "pills".

### 10.3 Gear Cross-Reference

The bundled `gear_db` (~983 entries) merges every item from the source
spreadsheet's `Helmet`, `Armour`, `Necklaces`, `Trinkets`, `Gloves`,
`Cloaks`, `Boots`, and `Weapons By Type` tabs. Each entry stores name,
slot, location text, act number, description, and (for weapons) category.

When a gear pill in the catch-up panel matches a record in `gear_db`:
- The pill shows a short suffix like `· Act 1` for at-a-glance act timing.
- Tapping the pill pushes a gear-detail sheet onto the back-stack
  (back-arrow returns to the timeline). The detail sheet shows Slot/
  Category, Where (free-text location), When (act), and Effect text.

When a gear pill does **not** match (~30% of options — the source
spreadsheet's gear tabs are not 100% complete), the pill renders with a
dashed border in dim ink and is non-interactive. The user still sees the
recommendation, just without cross-referenced location data.

Match logic uses normalized exact match (lowercase, strip `[Origin]`
tags and punctuation, trim whitespace) with singular/plural fallbacks
and a token-set fuzzy match for cases where word order differs.

### 10.4 Bundle Size

With definitions, extras, and gear DB embedded:
- `full_bundle.json`: ~720 KB minified JSON
- `index.html`: ~790 KB (bundle + CSS + JS)

Still acceptable for a static PWA. First-paint cost is the parse of
that JSON (negligible on modern devices); subsequent renders cache the
indices in module-scope.
