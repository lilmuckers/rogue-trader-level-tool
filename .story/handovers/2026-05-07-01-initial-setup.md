# Initial storybloq Setup

## Project
Rogue Trader Build Tracker — static PWA, vanilla JS, npm, hosted at rt.patrick-mckinley.com. GitHub: lilmuckers/rogue-trader-level-tool.

## Current State (v1.1.1)
Feature-complete through phases core, content, and ux-polish. Active development continues.

**Working features:**
- Level tracker (1–55), character cards, party roster with MC + 15 companions
- Bottom sheet: per-level descriptions, catch-up timeline, gear DB cross-reference
- 5-tab nav: Builds, Colonies, Traders, Resources, Notes
- Notes: markdown, checkboxes (tappable), undo/redo, auto-save, archive/delete lifecycle
- Traders: profit factor stepper (hold = 10/s), rep levels, alignment vendor, gear details
- Reorder mode (drag handles), swipe-left to remove companions
- Splash screen, portraits, drag-to-reorder
- SW versioning: bump package.json version → npm run release:patch/minor/major → rebuilds data.js + sw.js automatically
- SW update badge: pulsing ⟳ top-right when update available, toast with Reload Now
- Google Analytics (G-H6KCF4RNBT) with persistent UUID

## Setup Decisions
- Language: JavaScript (vanilla, no framework, no TypeScript)
- Type: npm (build step only — generates data.js from YAML via scripts/build.js)
- Quality: minimal (no test suite)
- Review backends: lenses + agent (existing config preserved)
- Phases: core/content/ux-polish marked complete; multi-profile and future are active backlog

## Next Work
T-001 (ProfileStore) is the unblocked entry point for multi-profile. T-002–T-005 all depend on it. The multi-profile plan was designed and reviewed in a prior session but not yet implemented.