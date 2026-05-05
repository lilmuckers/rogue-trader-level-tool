# Rogue Trader Build Tracker — Specification

## 1. Overview

A single-page, offline-capable web application that displays level-by-level
build progression for a player's chosen Main Character (MC) build and a
selected variant for each companion in *Warhammer 40,000: Rogue Trader*
(Owlcat Games). The intended use is mid-session reference on a phone: the
player advances a level counter and the app shows what to take for every
character at that level.

The app is built as a static Progressive Web App (PWA) suitable for hosting
on GitHub Pages and installation to an iOS home screen for fully offline use.

### 1.1 Source Material

Build data is derived from
[Revan619's Community Rogue Trader Unfair Builds & Resources](https://docs.google.com/spreadsheets/d/1rskX4sYcNm6Wqt4rtm8EQqRR4__yrEuxCEzjwoKlHOY/),
specifically the `Revan619 1.5 Builds` and `Revan619 1.5 Companion Builds`
sheets (game patch 1.5, including DLC).

### 1.2 Goals

- Eliminate context-switching to a Google Sheet during play.
- Work fully offline once installed (airplane mode, poor signal).
- Persist user choices across sessions on the device.
- Render legibly on a small phone screen with one-handed use.
- Reflect party-availability state: only show picks for companions the
  player has actually recruited at their current level.

### 1.3 Non-goals

- Editing or contributing builds back to the source spreadsheet.
- Multi-device sync. Storage is per-device.
- Coverage of older patch versions (1.2, 1.3, 1.4) or non-Revan619 build
  authors present in the source spreadsheet.
- Gear / talent / ability *reference* lookup. The source sheet has dedicated
  tabs for these; this app shows only level-up picks.
- Bundling official character portrait artwork. Portraits are user-supplied
  URLs (see §2.7).
- Respec workflow. The source builds are explicitly designed for play
  without respec; the app reflects that linear progression.

---

## 2. Domain Model

### 2.1 Build

A Build represents a complete level 1–55 progression plan for a single
character. It comprises:

| Field | Type | Notes |
|---|---|---|
| `name` | string | Human-readable build name (e.g. "Commissar taking command") |
| `theme` | string | MC builds only. Groups variants (e.g. "Commissar", "Arbitrator"). |
| `origin` | string | MC builds only. Free-text origin/archetype/stat description. |
| `levels` | map<int, LevelEntry> | Keyed by level number, 1–55 inclusive. |

### 2.2 LevelEntry

The pick(s) the player should take when leveling up to the keyed level.

| Field | Type | Notes |
|---|---|---|
| `m` | string \| null | "Main" pick — the primary ability, talent, stat, skill, or heroic action gained at this level. |
| `e` | string \| null | "Extra" pick — a second pick taken at the same level. May be absent. |

A level entry may have only `m`, only `e`, or both. The level number itself
is always present in the source sheet but the picks may be empty.

The source sheet uses the following picks-per-level convention, encoded
verbatim into `m` / `e` strings without further structuring:

- `Ability` — newly granted ability
- `Skill` — skill point allocation
- `Talent` — archetype talent
- `Common Talent` — common talent (any-archetype)
- `Heroic Action` — new heroic action or upgrade
- `Stats` — characteristic improvement

Slashes in the source (e.g. `"Commerce / Lore Imperium"`) indicate "either
of these" and are preserved verbatim.

### 2.3 Companion

A Companion has a fixed identity (e.g. "Abelard", "Cassia") and 1–N
**variants**, each variant being a complete Build. Companion identity also
implies a fixed archetype displayed in the UI.

The 15 supported companions and archetypes are:

| Companion | Archetype | Variants in 1.5 | Default Join Level |
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

Default join levels reflect the typical chapter-level progression in the
game (Ch 1: 1–15, Ch 2: 16–30, Ch 3: 31–36, Ch 4: 37–42). They are
**user-configurable** per-companion in the Setup view, so they can be
adjusted to match a specific playthrough's pacing.

### 2.4 MC Themes

MC builds are grouped into themes. Each theme contains 1–N variant builds.
The 11 themes in 1.5 are: Commissar, Astra Militarum Commander, Imperial
Navy Officer, Ministorum Priest, Noble, Crimelord, Arbitrator, Sanctioned
Psyker (Offensive), Sanctioned Psyker (Support), Mixed/Specialty,
Navigator/Psyker Hybrid. Total: 65 MC builds.

### 2.5 Configuration

The user's saved selection consists of:

```
{
  mc: { theme: string, buildIndex: int },
  companions: { [companionName: string]: int },
  joinLevels: { [companionName: string]: int }
}
```

Where `buildIndex` and the companion `int` values are zero-based indices
into the variants array for that theme / companion. `joinLevels` values
are clamped to `[1, 55]`.

### 2.6 Level State

A single integer in the closed range `[1, 55]`, persisted independently
of the configuration so that selecting a different roster does not reset
the player's current level.

### 2.7 Portraits

Each character (MC and all 15 companions) has an optional portrait image
URL. Portraits are **not bundled** with the app — they are configured at
build time by editing a `PORTRAITS` constant in `index.html`:

```js
const PORTRAITS = {
  'Rogue Trader': 'https://example.com/mc.jpg',
  'Abelard': 'https://example.com/abelard.jpg',
  // ...
  'Uralon': null,   // null → fallback rendered
};
```

The user is expected to source their own image URLs (typically from the
Fextralife or Fandom Rogue Trader wikis). When a URL is `null` or fails to
load, the app renders a **gothic initial fallback** — a circular badge
with the character's two-letter initials in Cinzel display font, gold-on-
dark, matching the app aesthetic.

Image requests use `referrerPolicy: 'no-referrer'` to maximise the chance
of success against hot-link blockers. Successfully loaded images are then
cached by the service worker for offline use.

---

## 3. User Interface

### 3.1 Views

The app has exactly two views, swapped by toggling visibility (no routing):

1. **Setup View** — initial configuration and editing.
2. **Tracker View** — primary in-play view.

#### 3.1.1 Setup View

Contains:
- An **MC section** with two cascading dropdowns: **Theme** then **Build**.
  Changing the theme repopulates the build dropdown.
- A **Companions section** with one row per companion containing:
  - Variant dropdown (auto-disabled if there is only one variant).
  - **Join Level** numeric input (1–55), defaulting from §2.3.
- A primary **Confirm & Begin** button that saves the configuration and
  transitions to Tracker View.
- A **Cancel** button that returns to Tracker View without saving (only
  shown if a saved configuration already exists).
- A **Reset All Data** button that clears stored configuration and level
  (only shown if a saved configuration already exists).

On first launch the form is pre-populated:
- MC: Commissar / "Commissar taking command"
- Companions: variant index 0 for each
- Join levels: §2.3 defaults

#### 3.1.2 Tracker View

Contains, top to bottom:
1. A header with app title.
2. Action row: **Edit Roster** (returns to Setup) and **Jump ▸ Lvl**
   (prompts for a numeric level).
3. A **Level Pane** with `−` / `+` buttons flanking a large central level
   number. The number itself is tappable and prompts for a numeric jump.
   The `−` button is disabled at level 1; `+` is disabled at level 55.
4. The **Roster** — a vertical list of character cards:
   - The MC card is shown first, visually distinguished (red accent stripe
     + gold name) to anchor attention.
   - A divider labelled "Retinue".
   - One card per companion in the canonical order defined in §2.3.
5. A footer flavour line.

#### 3.1.3 Character Card

Each card is a horizontal row with three regions:

1. **Portrait** (left) — 56×56px circular image with a gold border (red
   for the MC). Falls back to a gothic initial badge if no URL or load
   fails. Greyed (`grayscale + brightness reduction`) when the character
   is unavailable at the current level.

2. **Body** (right) — contains:
   - Character name (top-left) and archetype (top-right, monospace caps).
   - Build name (small italic, secondary).
   - One of three states for the bottom region:
     - **Available + has pick**: main pick (`m`) in large gold, optional
       extra pick (`e`) below in dim italic with `+` prefix.
     - **Available + no pick**: italic placeholder ("— no pick at this
       level —"), card dimmed to ~60% opacity.
     - **Unavailable** (level < join level): a small Cinzel-caps tag
       reading `⛓ Joins at level N`. Pick text is hidden. Card dimmed
       to ~42% opacity, portrait greyscaled.

### 3.2 Navigation Rules

- On load: if no saved configuration → Setup View. Otherwise → Tracker View.
- Saving in Setup → Tracker View.
- Tapping Edit Roster → Setup View. Cancel returns without changes.
- Reset All Data clears storage, resets level to 1, and remains in Setup.

### 3.3 Visual Design

The aesthetic is gothic-imperial: dark background (`#0a0908`) with gold
accents (`#c9a44c`, `#e8c468`) and a blood-red highlight (`#8b1a1a`)
reserved for the MC and small ornamental diamonds.

Typography:
- **Cinzel** (display) — headings, button labels, level number, character
  names, archetype labels, fallback initials.
- **EB Garamond** (body) — pick text, subtitles, italic flavour.
- **JetBrains Mono** (monospace) — archetype tags, join-level inputs.

All three are loaded from Google Fonts. The service worker caches the CSS
and woff2 files after first load.

### 3.4 Touch & Input

- Minimum tap target for the `−` / `+` buttons is 56×56 px.
- `touch-action: manipulation` is applied to all interactive elements.
- `-webkit-tap-highlight-color: transparent` removes the iOS tap flash.
- Body uses `overscroll-behavior: none` to suppress rubber-band scroll.
- Numeric inputs hide native spinners (cleaner on mobile).

---

## 4. Persistence

All persistence is local-only via `localStorage`.

### 4.1 Storage Keys

| Key | Value | Notes |
|---|---|---|
| `rt.config.v2` | JSON-encoded Configuration object | Schema as in §2.5 |
| `rt.level.v1` | JSON-encoded integer | See §2.6 |

The schema version is bumped (`v1` → `v2`) when the Configuration shape
changes incompatibly. The current bump added the `joinLevels` map.

### 4.2 Migration

On startup, if `rt.config.v2` is absent but `rt.config.v1` exists, the app
reads the v1 record, copies over `mc` and `companions`, fills `joinLevels`
from the §2.3 defaults, writes `rt.config.v2`, and removes `rt.config.v1`.
This is one-shot and silent.

### 4.3 Storage Fallback

The implementation wraps `localStorage` in a small abstraction (`Store`)
that probes for storage availability on init. If `localStorage.setItem`
throws (e.g. running inside Claude.ai's sandboxed iframe, Safari Private
mode), it transparently falls back to an in-memory object. The PWA on a
real origin always uses `localStorage`.

### 4.4 Reset Semantics

The "Reset All Data" button removes both keys, sets the in-memory level to
1, clears `config`, and re-renders Setup. There is a `confirm()` prompt
before destruction.

---

## 5. PWA Behaviour

### 5.1 Manifest

`manifest.json` declares:
- `name`: "Rogue Trader Build Tracker"
- `short_name`: "RT Tracker"
- `start_url`, `scope`: `./` (relative; works under any GitHub Pages path)
- `display`: `standalone`
- `orientation`: `portrait`
- `background_color`, `theme_color`: `#0a0908`
- Icons at 192 and 512, plus a 512 maskable.

### 5.2 Icons

A custom icon set is bundled, depicting a gold "RT" monogram inside a
double gold ring with cardinal-point cartography ticks and two small
blood-red diamonds. The maskable variant pads the design into the inner
~78% to satisfy Android adaptive-icon safe-zone requirements.

Provided sizes: 16, 32, 180 (Apple touch icon), 192, 512, 512-maskable.

### 5.3 Service Worker

`sw.js` implements:
- **Install**: pre-caches the app shell (`./`, `./index.html`, the
  manifest, and all icon variants).
- **Activate**: deletes any caches whose name does not match the current
  `CACHE_VERSION` constant.
- **Fetch**:
  - HTML / navigations → cache-first, then network, with `./index.html`
    as a final offline fallback.
  - `fonts.googleapis.com` and `fonts.gstatic.com` → stale-while-revalidate.
  - All other GETs (same-origin assets, third-party portrait images) →
    cache-first, fall through to network and update the cache. This means
    portrait images are cached opportunistically on first successful load
    and remain available offline thereafter.

The SW is registered after `window.load` to avoid blocking first paint.

### 5.4 Update Strategy

Cache invalidation is manual: bumping the `CACHE_VERSION` string in `sw.js`
purges the old cache on the next activate cycle. Bumping the version is
required after:
- Re-extracting build data (§6).
- Updating the `PORTRAITS` URL map.
- Any change to `index.html`, `manifest.json`, or the icons.

A user must reload the page once online to pick up new SW code (standard
PWA update behaviour). No update prompt UI is implemented.

---

## 6. Data Pipeline

The build data is **embedded as a JavaScript constant** in `index.html` —
not fetched at runtime. This makes the app a single deployable HTML file
plus assets, with no XHR for the data and no dependency on the source
spreadsheet at runtime.

### 6.1 Source Format

Each build sheet in the source spreadsheet uses a tile layout: theme blocks
arranged vertically (every 24 rows), variants arranged horizontally within
each block (every 13 columns). Within a single variant, level data is laid
out in three column-groups of `(label, main, extra)`:
- Levels 1–15 in the first column-group, rows 1–15 of the block.
- Levels 16–35 in the second column-group, same rows (5 rows of overflow
  from row 16 onward).
- Levels 36–55 in the third column-group.

The level label cells contain strings like `"Level 15 :"`. Extraction
parses the integer out of these labels and pairs it with the next two
cells in the same row.

### 6.2 Extraction Script

A Python script (not bundled with the app) loads the workbook with
`openpyxl`, walks each block via known row/column offsets, parses the
level-label cells, and emits a single JSON document of the shape:

```
{
  "mc_builds": [ Build, ... ],
  "companions": { "Abelard": [Build, ...], "Idira": [Build, ...], ... }
}
```

LevelEntry objects use the compact `{m, e}` shape (§2.2) to minimise
embedded payload size. The current bundle is ~257 KB minified.

URLs (YouTube links etc.) are stripped from build names before embedding.

### 6.3 Re-running Extraction

If the source sheet updates (new patch, new variants):
1. Re-download the sheet as `.xlsx`.
2. Run the extraction script to produce new JSON.
3. Replace the `const DATA = {...}` line in `index.html` with the new JSON.
4. Bump `CACHE_VERSION` in `sw.js`.
5. Commit and push.

---

## 7. File Layout

The deployable bundle is a flat directory:

```
/
├── index.html              — App + embedded data + inline CSS & JS + PORTRAITS map
├── manifest.json           — PWA manifest
├── sw.js                   — Service worker
├── icon-16.png             — Favicon
├── icon-32.png             — Favicon
├── icon-180.png            — Apple touch icon
├── icon-192.png            — PWA icon (any)
├── icon-512.png            — PWA icon (any)
├── icon-512-maskable.png   — PWA icon (maskable, Android adaptive)
├── README.md               — Deployment instructions
└── SPEC.md                 — This document
```

All paths in `manifest.json`, `sw.js`, and `index.html` are relative
(`./...`) so the app works correctly under a GitHub Pages project URL
(`/<repo>/`).

---

## 8. Deployment

### 8.1 Hosting

Designed for **GitHub Pages** (Settings → Pages → Deploy from branch →
main / root). Any other static host that serves over HTTPS and respects
relative paths will also work. HTTPS is required for the service worker
to register on a real origin.

### 8.2 Installation on iOS

1. Open the deployed URL in **Safari** (PWA install on iOS is
   Safari-exclusive).
2. Share → **Add to Home Screen**.
3. Open the home-screen icon at least once while online; the service
   worker pre-caches the shell and progressively caches portrait images
   as they load.
4. The app then runs offline.

### 8.3 Installation on Android

Chrome offers an "Install" prompt or menu item. The maskable icon is
used for the adaptive icon. Behaviour otherwise matches iOS.

---

## 9. Constraints & Assumptions

- The app is **single-user, single-device**. No accounts, no sync, no
  backend.
- The build data is a **point-in-time snapshot**. There is no live
  connection to the source spreadsheet; updates require a redeploy.
- Targets **modern mobile Safari (iOS 16+) and modern Chromium**. No
  effort is made to support older browsers; the app uses ES2020+
  syntax and `localStorage` without polyfill.
- Maximum supported character level is **55** (the in-game cap with
  current DLC).
- Portrait URLs are user-supplied and may break over time (wiki revisions
  re-hash filenames). The fallback initial badge ensures the UI degrades
  gracefully.
- Default join levels are approximations of typical playthrough pacing,
  not authoritative game data. The Setup view exposes them for adjustment.
- The source spreadsheet's ordering, naming, and structure conventions
  are treated as authoritative. If Revan619 reorganises the sheet, the
  extraction script will need adjusting.
