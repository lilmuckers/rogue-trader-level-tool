# Rogue Trader Build Tracker — Specification

_Current version: 1.10.x · Last updated: 2026-05-29_

---

## 1. Overview

A single-page, offline-capable web application for tracking level-by-level build
progression in *Warhammer 40,000: Rogue Trader* (Owlcat Games). Intended for
mid-session reference on a phone: the player advances a level counter and the app
shows what to take for every character at that level, with on-demand descriptions,
build timelines, gear cross-references, vendor/trader listings, a full reference
library, and a custom build manager.

Built as a static Progressive Web App (PWA) hosted on GitHub Pages, installable
to an iOS home screen for fully offline use.

### 1.1 Source Material

Build data is derived from
[Revan619's Community Rogue Trader Unfair Builds & Resources](https://docs.google.com/spreadsheets/d/1rskX4sYcNm6Wqt4rtm8EQqRR4__yrEuxCEzjwoKlHOY/)
(game patch 1.5, including all DLC). Item and gear data additionally sourced from
[GameFAQs Rogue Trader community](https://gamefaqs.gamespot.com/pc/336075-warhammer-40000-rogue-trader).

### 1.2 Goals

- Eliminate context-switching to a Google Sheet or wiki during play.
- Work fully offline once installed.
- Persist all user state on-device across sessions.
- Render legibly on a small phone screen with one-handed use.
- Surface build timelines, gear cross-references, and game mechanic
  descriptions on demand.
- Support custom (non-canonical) builds via in-app editor or JSON/URL import.

### 1.3 Non-goals

- Multi-device sync. Storage is per-device.
- Coverage of older patch versions (pre-1.5) or non-Revan619 builds (except
  via the custom Workshop feature).
- Respec workflow.
- Community build sharing requiring a backend (scoped to local + Gist export).

---

## 2. Domain Model

### 2.1 Build

A Build represents a complete level 1–55 progression plan for one character.

| Field | Type | Notes |
|---|---|---|
| `name` | string | Human-readable build name. |
| `theme` | string | MC builds only. Groups variants by playstyle. |
| `origin` | string | MC builds only. Origin/archetype/stat description. |
| `levels` | map<int, LevelEntry> | Keyed by level number, 1–55 inclusive. |
| `dlc` | string \| null | DLC name if build requires DLC content. |

Custom builds (Workshop) additionally carry `_id`, `_custom: true`,
`_character`, and optional `_source` for URL-sync.

### 2.2 LevelEntry

| Field | Type | Notes |
|---|---|---|
| `m` | string \| null | "Main" pick. |
| `e` | string \| null | "Extra" pick. May be absent. |

A pick string may contain alternatives separated by `/` (e.g.
`"Commerce / Lore Imperium"`). The lookup logic handles each alternative
independently.

### 2.3 Companions

15 supported companions:

| Companion | Archetype | Variants | Default Join Level | DLC |
|---|---|---|---|---|
| Abelard | Warrior | 5 | 1 | — |
| Idira | Operative | 3 | 1 | — |
| Argenta | Soldier | 3 | 3 | — |
| Pasqal | Operative | 7 | 6 | — |
| Cassia | Officer | 2 | 10 | — |
| Heinrix | Warrior | 6 | 12 | — |
| Yrliet | Operative | 3 | 14 | — |
| Jae | Officer | 3 | 16 | — |
| Ulfar | Soldier | 3 | 22 | — |
| Marazhai | Warrior | 2 | 31 | — |
| Kibellah | Bladedancer | 3 | 33 | Void Shadows |
| Solomorne | Soldier | 1 | 37 | Lex Imperialis |
| Incendia Chorda | Soldier | 1 | 40 | Lex Imperialis |
| Calligos Winterscale | Warrior | 1 | 40 | Lex Imperialis |
| Uralon | Officer | 1 | 40 | Lex Imperialis |

Default join levels are user-configurable per-companion in Setup.

### 2.4 MC Themes

11 themes, 65 builds total: Commissar, Astra Militarum Commander,
Imperial Navy Officer, Ministorum Priest, Noble, Crimelord, Arbitrator,
Sanctioned Psyker (Offensive), Sanctioned Psyker (Support),
Mixed/Specialty, Navigator/Psyker Hybrid.

### 2.5 Configuration & Roster

The **roster** is an ordered array of `{char, build, joinLevel}` records
(replaces the old flat config object). The active MC build and all companion
selections are stored here. The player can reorder the roster in Setup.

Join levels are clamped to `[1, 55]`.

### 2.6 Level State

Integer in `[1, 55]`, persisted independently of roster configuration.

### 2.7 Definitions & Lookup

Bundled definition tables:

| Table | Notes | Approx. entries |
|---|---|---|
| `talents` | Name → description from Revan619 Talents sheet | ~659 |
| `abilities` | Name → description from Abilities sheet; archetype-header rows parsed specially | ~137 |
| `heroic` | Hardcoded supplement: Heroic Actions and high-frequency unlisted picks | ~33 |

`lookupPick(rawPick)` resolves a pick string:
1. Split on `/` for alternatives.
2. Normalize (lowercase, collapse whitespace, strip punctuation, fix known
   typos: `Tacticical`, `Eagar`, `Devestating`, `Versitility`, `Camraderie`, etc.).
3. Check priority order: heroic → abilities → talents.
4. Fallback variants: strip trailing roman numeral tier, strip
   `Characteristic Training:` prefix, strip trailing punctuation.
5. Skill/stat allocations (Agility, BS, AP +1, etc.) are labelled without
   DB lookup.

Coverage ~89% of lookup-eligible picks on real build data.

### 2.8 Gear Database

`gear_db` (~1 049 entries) covers: Helmets, Armour, Cloaks, Necklaces,
Trinkets, Gloves, Boots, Weapons, Shields, Familiars. Each entry:

| Field | Notes |
|---|---|
| `n` | Name |
| `s` | Slot (`armour`, `weapon`, `helm`, etc.) |
| `l` | Location text (free-text) |
| `a` | Act number (0–4) |
| `d` | Effect description |
| `cat` | Category (weapons only, e.g. `Shield`) |
| `dlc` | DLC name or null |

Shields are weapons with `cat: Shield` — displayed as a separate group in
the gear browser.

### 2.9 Archetypes

Each build records three chosen archetypes (tier 1/2/3) extracted from
the source sheet's header rows. Stored in
`DATA.archetypes.{mc,comp}[buildName] = {t1, t2, t3}`.

Archetype callout cards appear on character cards and in the catch-up
timeline when the current level is 16 (tier-2 choice) or 36 (tier-3 choice).

### 2.10 Extras (Skills & Gear Panels)

Each build may have an `extras` block with:
- `skills` — free-text skill allocation recommendation.
- `gear` — array of `{slot, options}` where `options` is a `/`-separated
  list of gear name alternatives.

Rendered in the Catch-Up Timeline's "Gear & Skills" tab. Gear pills that
match `gear_db` are interactive (tap → gear detail sheet).

### 2.11 Custom Builds (Workshop)

Custom builds are stored in `localStorage` under `rt-custom-builds`.
They follow the same `{name, theme, origin, levels}` shape as canonical
builds, augmented with `_id`, `_custom: true`, `_character`, and
optional `_source: {type: 'url'|'gist'|'json', url?, gistId?}`.

At startup, custom builds are merged into `DATA.mc_builds` and
`DATA.companions` so the rest of the app treats them identically to
canonical builds.

### 2.12 Vendors / Traders

`DATA.vendors` — array of vendor objects, each with `name` and either
`items[]` or (for alignment vendors) `neutral_items[]`,
`dogmatic_items[]`, `iconoclast_items[]`, `heretic_items[]`.

`DATA.questRewards` — flat item array from quest-rewards source.

---

## 3. User Interface

### 3.1 Navigation

Bottom navigation bar with up to 8 sections (icon + label):

| Section | Icon | Notes |
|---|---|---|
| Tracker | ⚔ | Primary in-play view |
| Setup | ⚙ | Roster/build configuration |
| Gear | 🛡 | Gear browser |
| Reference | 📖 | Reference library |
| Workshop | 🔧 | Custom build manager |
| Resources | 🌌 | Star systems / resources |
| Colonies | 🏛 | Colony tracker |
| Notes | 📝 | Free-text notes |

The active section's content replaces the main body area. A version/about
footer renders below the nav bar showing `vX.Y.Z`.

### 3.2 Setup View

- MC theme + build cascading dropdowns.
- Roster table: one row per companion with variant dropdown, `Joins @`
  numeric input, and drag-handle for reordering.
- MC name override field.
- Confirm / Cancel / Reset All Data.
- Pre-populated with sensible defaults on first launch.

### 3.3 Tracker View

- Header with title.
- Action row: Edit Roster, Jump ▸ Lvl.
- Level Pane: large level number, `−` / `+` buttons, tap-to-jump modal.
- Roster: MC card first (blood-red accent), "Retinue" divider, then
  companions in roster order.
- Cards show current-level picks; dimmed/greyscaled when unavailable.
- Footer flavour text.

#### 3.3.1 Character Card

Horizontal layout: portrait (56×56 circle) | name + archetype + build name
+ pick block (or no-pick / unavailable tag).

Interactions:
- **Short tap** → Description Sheet for current level's picks.
- **Long-press** (≥480 ms, cancels on >10 px movement, haptic feedback)
  → Catch-Up Timeline sheet.

#### 3.3.2 Bottom Sheet

Modal slide-up sheet:
- Drag-handle, title, close (×).
- Scrollable body; max height 85 vh.
- Swipe-down-to-close (>80 px drag from scrolled-to-top position).
- Backdrop tap or ESC (desktop) dismisses.
- Back-stack navigation for nested sheets (e.g. gear pill → gear detail
  → back to timeline).

**Description Sheet**: Level N picks, one block per resolved pick (name,
source label, description). Alternatives rendered as separate blocks.

**Catch-Up Timeline Sheet**: Three tabs:
1. **Timeline** (default) — levels 1–55, current level highlighted.
   Each row tap → nested Description Sheet for that pick.
2. **Stats** — characteristic summary up to current level (training
   counts + AP gained + origin bonuses; absolute values when companion
   base stats are available).
3. **Gear & Skills** — skill note paragraph + gear pills per slot (from
   build extras). DLC-tagged items show pill badge.

### 3.4 Gear Browser

Filterable list of `gear_db` entries.

Filters (custom dropdown UI):
- **Slot** — All, Armour, Weapons, Shields, Helms, Cloaks, Gloves, Boots,
  Necklaces, Trinkets, Familiars.
- **DLC** — All, Base game, Lex Imperialis, Void Shadows.
- **Character** — Any, MC, or specific companion (shows only items used
  by that character's builds).
- **Act** — Any, Prologue, Act 1–4.
- **Search** — Name / description / location text.

Results grouped by slot with item count headings. Each row shows name,
DLC badge, act badge, used-by character abbreviations, and truncated
description. Tapping a row opens a Gear Detail sheet.

Items can be favourited (star button) for Quick Access.

### 3.5 Reference Library

Tabbed reference sections with cross-section full-text search:

| Section | Content |
|---|---|
| Homeworlds | All homeworld options with bonuses |
| Origins | All origin options with bonuses |
| Backgrounds | Background choices |
| Characteristics | All 9 characteristics explained |
| Abilities | All ability definitions |
| Talents | All talent definitions |
| Retinue | Companion bios, base stats, DLC tags |
| Romances | Per-character romance guides (gender requirements noted) |
| Convictions | Dogmatic / Iconoclast / Heretic point thresholds and tier bonuses |

**Search bar** at top filters all sections simultaneously. Results show
the section name as context.

**Quick Access** panel (top of Reference view) shows favourited items.
Tapping a favourite scrolls directly to that item within its section and
briefly highlights it with a gold outline.

### 3.6 Workshop

Custom build manager:

- **Build list** — shows all custom builds with character, name, source
  badge, Edit / Delete / Gist export buttons.
- **Import** — paste raw JSON or enter a URL (fetched and parsed at import
  time and on background refresh every 30 minutes).
- **Build editor** — level-by-level editor (main + extra pick per level,
  skills, gear slots, archetype paths).
- **GitHub Gist sync** — store a personal access token (PAT); export
  builds to Gist as JSON; re-import from Gist URL. No OAuth app required.

### 3.7 Resources (Star Systems)

`DATA.resourceSystems` — array of star systems with resource node data.
Browseable list with search; each entry shows system name, resources
available, and notes.

### 3.8 Colonies

`DATA.colonies` — colony data per planet. Shows colony name, level
indicators, and available upgrades.

### 3.9 Notes

Free-text markdown-lite notes with:
- Create / edit / delete.
- Sort by updated or created time.
- Undo history per note (persisted in `rt.notes-history.v2`).
- Character-reference tags linking a note to a specific companion/build.

### 3.10 Traders / Vendors

Tabbed view per faction (Kasballica Mission, Explorators, Drusians,
Imperial Navy, Fellowship of the Void, Curiosity Vendor + Quest Rewards).
Alignment vendors show Neutral / Dogmatic / Iconoclast / Heretic tabs.
Item rows show name, description snippet, act badge, and DLC badge.

---

## 4. Visual Design

Gothic-imperial palette: `#0a0908` background, gold accents (`#c9a44c`,
`#e8c468`), blood-red (`#8b1a1a`) for MC.

Typography:
- **Cinzel** — headings, level number, character names, archetype labels.
- **EB Garamond** — pick text, description body, italic flavour.
- **JetBrains Mono** — archetype tags, source labels, code-like elements.

DLC badges: pill-style colour-coded (Lex Imperialis = amber, Void Shadows
= purple).

---

## 5. Touch & Input

- 56×56 px minimum tap targets for level controls.
- `touch-action: manipulation` everywhere.
- Card long-press cancels on >10 px movement.
- iOS context menu suppressed on cards.
- Cards animate `scale(0.99)` + box-shadow on hold.
- Swipe-down-to-close on bottom sheets.
- `scrollIntoView({ block: 'center' })` for Quick Access navigation
  (avoids iOS notch overlap).

---

## 6. Persistence

All state in `localStorage` via the `Store` abstraction (falls back to
in-memory when `localStorage` is unavailable).

| Key | Contents |
|---|---|
| `rt.config.v2` | Legacy MC + companion config (migrated to roster on first run) |
| `rt.level.v1` | Current level integer |
| `rt.choices.v1` | Per-level user pick choices |
| `rt.mc-name.v1` | Custom MC name override |
| `rt.roster.v1` | `[{char, build, joinLevel}]` ordered array |
| `rt.party.v1` | `[charName]` active party (max 5) |
| `rt.notes.v1` | Notes array |
| `rt.notes-sort.v1` | Notes sort preference |
| `rt.notes-history.v2` | Per-note undo history |
| `rt-custom-builds` | Custom Workshop builds |
| `rt-gist-pat` | GitHub Gist personal access token |
| `rt-ref-favourites` | Favourited reference items |

---

## 7. PWA Behaviour

### 7.1 Manifest

`manifest.json`: standalone display, portrait orientation, relative paths,
gold-on-dark theme, icons at 192/512 plus 512 maskable.

`<meta name="mobile-web-app-capable">` used (not deprecated
`apple-mobile-web-app-capable`).

### 7.2 Service Worker

`sw.js` implements:
- **Install**: pre-caches app shell.
- **Activate**: deletes stale caches not matching `CACHE_VERSION`.
- **Fetch**:
  - HTML / navigations → cache-first, network fallback, `index.html`
    final fallback.
  - Google Fonts → **3-second timeout race** (not stale-while-revalidate).
    On slow connections, fonts fall back to system serif/mono rather than
    hanging indefinitely.
  - Other GETs (icons, portrait images) → cache-first, network fallback.

### 7.3 Update Strategy

`CACHE_VERSION` is auto-updated by `npm run build` to match `package.json`
version. An **SW update badge** (`[↑]` in the footer) appears when a new
service worker is waiting; tapping it triggers `skipWaiting` and reloads.

Semantic versioning workflow:
```
npm version patch    # bug fixes / data updates → 1.X.Y
npm version minor    # new features             → 1.X.0
npm version major    # breaking changes         → X.0.0
npm run build        # regenerates data.js, app.js, updates sw.js
git push
```

---

## 8. Data Pipeline

Build and definition data lives in YAML files under `data/` and is
compiled by `scripts/build.js` into two generated files:

- **`data.js`** — `const DATA = {...}; const PORTRAITS = {...};`
- **`app.js`** — concatenation of all `js/*.js` source modules

`index.html` loads `data.js` then `app.js` via `<script>` tags. No XHR at
runtime.

### 8.1 YAML Source Layout

```
data/
├── portraits.yml                — Portrait URL map
├── definitions/
│   ├── talents.yml              — ~659 talent definitions
│   ├── abilities.yml            — ~137 ability definitions
│   ├── heroic.yml               — ~33 heroic/supplement definitions
│   ├── characteristics.yml      — Characteristic descriptions
│   ├── convictions.yml          — Conviction tiers and bonuses
│   ├── homeworlds.yml           — Homeworld options
│   ├── origins.yml              — Origin options
│   ├── dlc-tags.yml             — DLC display names
│   └── romances.yml             — Per-character romance guides
├── gear/                        — One .yml per slot (armour, helm, etc.)
├── mc/
│   └── {theme}/                 — One .yml per build
├── companions/
│   ├── base_stats.yml           — Starting characteristics for each companion
│   ├── bios.yml                 — Companion bios and DLC tags
│   └── {CompanionName}/         — One .yml per build variant
├── vendors/                     — One .yml per faction + quest-rewards.yml
├── colonies/                    — Colony data
└── resources/
    └── systems.yml              — Star system / resource data
```

### 8.2 JS Module Layout

`scripts/build.js` concatenates these files in order to produce `app.js`:

```
js/core.js          — Constants, version, utility DOM helpers
js/store.js         — localStorage abstraction with in-memory fallback
js/choices.js       — Config, roster, level, party state + migrations
js/lookup.js        — Pick normalization and description lookup
js/sheet.js         — Bottom-sheet infrastructure + back-stack
js/tracker.js       — Tracker view render
js/description.js   — Description sheet content
js/catchup.js       — Catch-up timeline, stats panel, pick-block renderer
js/setup.js         — Setup view
js/nav.js           — Bottom nav + section routing
js/colonies.js      — Colonies section
js/traders.js       — Traders/vendors section
js/notes.js         — Notes section
js/gear-browser.js  — Gear browser section
js/reference-library.js — Reference library section
js/resources.js     — Resources section + favourites infrastructure
js/workshop.js      — Workshop (custom build manager)
js/init.js          — App bootstrap (merge custom builds, render initial view)
```

### 8.3 Build Command

```bash
npm run build     # reads all YAML, writes data.js + app.js, updates sw.js
```

Run after editing any YAML file or source JS. The generated `data.js` and
`app.js` are checked in to the repo for deployment.

---

## 9. File Layout

```
/
├── index.html              — App shell (loads data.js + app.js + style.css)
├── style.css               — All styles
├── data.js                 — Generated: DATA + PORTRAITS constants
├── app.js                  — Generated: concatenated JS modules
├── manifest.json           — PWA manifest
├── sw.js                   — Service worker (CACHE_VERSION auto-updated)
├── package.json            — Version source of truth
├── scripts/
│   └── build.js            — Build pipeline
├── js/                     — JS source modules (see §8.2)
├── data/                   — YAML source data (see §8.1)
├── icon-{16,32,180,192,512,512-maskable}.png
├── README.md               — Deployment instructions
└── SPEC.md                 — This document
```

---

## 10. Deployment

GitHub Pages → Settings → Pages → Deploy from branch → main / root.
HTTPS required for service worker.

iOS install: open in **Safari** → Share → Add to Home Screen → launch once
online to populate caches.

---

## 11. Constraints & Assumptions

- Single-user, single-device. No accounts, no sync, no backend (except
  optional GitHub Gist export for Workshop builds).
- Build data is a point-in-time snapshot; updates require redeploy.
- Targets modern mobile Safari (iOS 16+) and modern Chromium. ES2020+.
- Max level 55 (current in-game cap).
- Portrait URLs are user-supplied and may break over time; initial badge
  is the graceful fallback.
- Default join levels are approximations; configurable per playthrough.
- Definition lookup coverage ~89%. Misses are visible to the user
  ("No description available") rather than silently hidden.
- The `heroic` supplement is best-effort game knowledge, not authoritative.
- DLC companions (Kibellah, Solomorne, Incendia Chorda, Calligos
  Winterscale, Uralon) are tagged; base stats for secret/DLC companions
  may be incomplete.
