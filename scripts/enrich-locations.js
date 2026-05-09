#!/usr/bin/env node
// scripts/enrich-locations.js
// Backfills null locations on gear YAML entries.
// Source: roguetrader.wiki.fextralife.com  (fetched 2026-05-08)
// Run once: node scripts/enrich-locations.js
// Does NOT overwrite existing non-null locations.

'use strict';

const fs   = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const ROOT    = path.join(__dirname, '..');
const gearDir = path.join(ROOT, 'data', 'gear');

// ── Locations keyed by exact item name ───────────────────────────────────────
// Source: roguetrader.wiki.fextralife.com
// Items not found on any wiki source are omitted.
// ─────────────────────────────────────────────────────────────────────────────

const LOCATIONS = {
  // ── Armour ──────────────────────────────────────────────────────────────
  'Armour of Despair':
    'Commorragh, Outer Spire Halls — after 3rd arena fight, pass Athletics/Demolition/Awareness checks to reach hidden container',

  // ── Cloaks ──────────────────────────────────────────────────────────────
  'Mantle of Heroism':
    'Kiava Gamma Manufactorum — dropped by Chaos Marine in easternmost area (unavoidable encounter)',
  'Rogue Trader\'s Cloak':
    'Dargonus — vault next to murder scene in Lord Captain\'s Quarters',
  'Noble Born Mantle':
    'Quest reward — Jae Heydari\'s Celebration (end of Jae\'s Chapter 2 quest line)',
  'Righteous Fury Cape':
    'Footfall Atrium — quest reward from Hieronymus Doloroso for Dreams and Stories',
  'Xeno-Pelt Cloak':
    'Source unknown — not documented on wiki',

  // ── Boots ───────────────────────────────────────────────────────────────
  'Death World Warboots': 'Purchased from Hieronymus Doloroso',
  'Disciple\'s Boots':    'Location not documented on wiki',
  'Lightweight Boots':    'Location not documented on wiki',

  // ── Gloves ──────────────────────────────────────────────────────────────
  'Operator\'s gloves':
    'Von Valancius Flagship — storeroom accessed via locked door left of mess hall, during By the Right of Blood',
  'Gloves of Endurance':   'Found during prologue',
  'Undying Rage':
    'Smuggler Hideout, Rocky World, Cradle of Khepri system. Also reward from Falco if Jae is handed over in Rat Hunting quest',
  'Avenger Tactical Gloves':
    'Commorragh, Outer Spire Halls — same hidden container as Armour of Despair and Peripheral Control Monocle',
  'The Hand of Avolius':   'Contract: Lugnalia\'s Crusade',
  'Sapper Gloves':         'Location not documented on wiki',
  'Knuckle-Dusters':       'Location not documented on wiki',
  'Grox Bracers':          'Location not documented on wiki',

  // ── Helmets ─────────────────────────────────────────────────────────────
  'Lexmechanic\'s Goggles':
    'Von Valancius Flagship — crate after bridge before Theodora\'s Chambers entrance, during By the Right of Blood',
  'Peripheral Control Monocle':
    'Commorragh, Outer Spire Halls — hidden container after 3rd arena fight (Athletics/Demolition/Awareness checks)',
  'Deck Officer\'s Helmet': 'Location not documented on wiki',
  'Mechanicus Respirator':  'Location not documented on wiki',

  // ── Necklaces ───────────────────────────────────────────────────────────
  'Grace of the Oblivious':
    'Von Valancius Flagship — looted from heretics who ambush as you exit toward voidship bridge, during By the Right of Blood',
  'The Last Flash':
    'Commorragh, Outer Spire Halls — chest by entrance to area after 3rd arena fight',

  // ── Trinkets ────────────────────────────────────────────────────────────
  'Theodora\'s Rosary':     'Location not documented on wiki',
  'Combi-Tool':             'Ancient Bunker, Oasis V, Nameless Star system',
  'Flamer Digi-Weapon':
    'Kiava Gamma — right wing of building (two chests), also room behind cogitator bridge (Cache on Kiava Gamma rumour)',
  'Forbidden Xenos Compendium': 'Location not documented on wiki',
  'Heart of the Nameless':
    'Janus — possible reward for Chronicle of the Protectorated Decision quest',
  'Imperial Scroll':        'Purchased from Hieronymus Doloroso',
  'Instability Detonator':  'Kiava Gamma — after completing The Motive Force Is Life colony project',
  'Shifting Combi-Tool':
    'Quest reward — given by Fabricator-Censor Cubis Delphim, Flame in the Dark',
  'Stimulant Injector':     'Footfall Atrium — Underworld Quest reward',
  'Target Designator':      'Purchased from Opticon-22',

  // ── Weapons ─────────────────────────────────────────────────────────────
  'Duelling Sword':         'Commorragh, The Pit — purchased from the Commissar',
  'Bloodseeker Klaive':
    'Jae Heydari gift — speak to Jae on voidship after completing Wanted on Footfall, select the business discussion option',

  // ── Additional from extended search ─────────────────────────────────────
  'Theodora\'s Rosary':
    'Prologue — chest to the right of the desk in Theodora\'s quarters (By the Right of Blood)',
  'Deck Officer\'s Helmet':
    'Prologue — looted from dead body in Navigator\'s Sanctum level 3 (By the Right of Blood)',
};

// ── Process each YAML file ───────────────────────────────────────────────────

let totalUpdated = 0;

for (const fname of fs.readdirSync(gearDir).filter(f => f.endsWith('.yml'))) {
  const fpath = path.join(gearDir, fname);
  const items = yaml.load(fs.readFileSync(fpath, 'utf8')) || [];
  let fileUpdated = 0;

  for (const item of items) {
    if (item.location) continue;              // already has one — skip
    const loc = LOCATIONS[item.name];
    if (!loc) continue;                       // not in our table — skip
    // Skip placeholder "not documented" entries
    if (loc.includes('not documented')) continue;
    item.location = loc;
    fileUpdated++;
    totalUpdated++;
    console.log(`  ✓ ${fname}: ${item.name}`);
  }

  if (fileUpdated > 0) {
    fs.writeFileSync(fpath, yaml.dump(items, { lineWidth: 120, quotingType: '"', forceQuotes: false }));
  }
}

console.log(`\nTotal updated: ${totalUpdated} locations`);
