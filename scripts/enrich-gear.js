#!/usr/bin/env node
// scripts/enrich-gear.js
// Backfills descriptions on gear YAML entries that currently have null descriptions.
// Source: roguetrader.wh40k.wiki  (fetched 2026-05-07)
// Run once: node scripts/enrich-gear.js
// Does NOT overwrite existing non-null descriptions.

'use strict';

const fs   = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const ROOT    = path.join(__dirname, '..');
const gearDir = path.join(ROOT, 'data', 'gear');

// ── Descriptions keyed by exact item name ────────────────────────────────────
// Values sourced from roguetrader.wh40k.wiki pages:
//   /Armour, /Cloaks, /Las_Weapons, /Solid_Projectile_Weapons,
//   /Bolt_Weapons, /Plasma_Weapons, /Chain_Weapons, /Power_Weapons,
//   /Heavy_Weapons, /Exotic_Weapons, /Melta_Weapons
//
// For weapon families with no unique effect, the description states the
// family passive. For basic stat-only items, a concise summary is used.
// ─────────────────────────────────────────────────────────────────────────────

const DESCRIPTIONS = {
  // ── Armour ──────────────────────────────────────────────────────────────
  'Efficient Armoured Bodyglove':      'Standard light armour (35% armour). No special effects.',
  'Pirate Chainmail':                   'Standard medium armour (50% armour). No special effects.',
  '[LD-Pattern] Heavy Leather Armor':  'Standard heavy armour (55% armour, 3 deflection). Requires Heavy Armour Proficiency.',
  'Incubus Armour':                     'Standard medium armour (45% armour). Requires Drukhari equipment.',
  'Kabalite Armour':                    'Standard light armour (30% armour). Requires Drukhari equipment.',

  // ── Cloaks ──────────────────────────────────────────────────────────────
  'Cloak of Mercy':   "Lidless Stare no longer damages allies; they gain Fellowship Bonus temporary wounds instead.",
  'Xeno-Pelt Cloak':  "Wearer takes −5 less damage from critical hits. +10 Coercion.",

  // ── Las weapons ─────────────────────────────────────────────────────────
  // Family passive: effective vs cover / high dodge
  'Las Pistol':                    'Laser weapons are effective against targets in cover and those with high dodge.',
  'Hot Shot Las Pistol':           'Laser weapons are effective against targets in cover and those with high dodge.',
  '[Mars-Pattern] Hot Shot Laspistol': 'Laser weapons are effective against targets in cover and those with high dodge.',
  'Archeotech Lasgun':             'Laser weapons are effective against targets in cover and those with high dodge.',

  // ── Solid Projectile weapons ─────────────────────────────────────────────
  // Family passive: +50% overpenetration
  'Autopistol':         'Solid projectile weapons have +50% overpenetration.',
  'Stub Revolver':      'Solid projectile weapons have +50% overpenetration.',
  'Ripper Autopistol':  'Solid projectile weapons have +50% overpenetration.',

  // ── Bolt weapons ────────────────────────────────────────────────────────
  '[Mezoa] Bolt Pistol':         'Standard bolt pistol variant.',
  'Bolt Pistol':                 'Standard bolt pistol.',
  '[Mars-Pattern] Bolt Pistol':  'Standard bolt pistol variant.',
  'Bolter':                      'Standard bolter.',
  '[Retobi] Bolter':             'Standard bolter variant.',
  'Storm Bolter':                'Standard storm bolter.',
  'Astartes Bolter':             'A favoured weapon of the Adeptus Astartes.',
  'Astartes Strom Bolter':       'Standard Astartes storm bolter.',
  'Heavy Bolter':                'Standard heavy bolter.',

  // ── Plasma weapons ──────────────────────────────────────────────────────
  'Plasma Pistol':                 'Standard plasma pistol. Requires Plasma Weapon Proficiency.',
  'Plasma Gun':                    'Standard plasma gun. Requires Plasma Weapon Proficiency.',
  '[Retobi] Plasma Pistol':        'Standard plasma pistol variant. Requires Plasma Weapon Proficiency.',
  'Heavy Plasma Gun':              'Heavy plasma weapon. Requires Plasma Weapon Proficiency.',
  '[Mezoa] Plasma Gun':            'Standard plasma gun variant. Requires Plasma Weapon Proficiency.',
  '[Retobi-Pattern] Plasma Gun':   'Standard plasma gun variant. Requires Plasma Weapon Proficiency.',
  '[Sol-Pattern] Plasma Pistol':   'Standard plasma pistol variant. Requires Plasma Weapon Proficiency.',

  // ── Melta weapons ───────────────────────────────────────────────────────
  'Focus Meltagun':  'Standard meltagun. Melta weapons are especially effective at short range.',

  // ── Webbers ─────────────────────────────────────────────────────────────
  'Improvised Webber':    'Webber weapon. Entangles enemies, reducing their mobility.',
  'Well Maintained Webber': 'Webber weapon. Entangles enemies, reducing their mobility.',

  // ── Exotic / Aeldari ranged ──────────────────────────────────────────────
  'Shuriken Catapult':            'Standard Aeldari shuriken weapon.',
  'Shuriken Canon':               'Heavy Aeldari shuriken weapon.',
  'Rune-Carved Shuriken Cannon':  'Heavy Aeldari shuriken weapon with rune carvings.',
  'Upgraded Shuriken Pistol':     'Upgraded Aeldari shuriken pistol.',

  // ── Drukhari ranged ─────────────────────────────────────────────────────
  'Splinter Cannon':          'Standard Drukhari splinter cannon.',
  'Violent Splinter Cannon':  'Drukhari splinter cannon variant.',
  'Piercing Splinter Cannon': 'Drukhari splinter cannon variant with improved penetration.',

  // ── Heavy weapons ───────────────────────────────────────────────────────
  'Heavy Flamer':       'Standard heavy flamer. Area-of-effect flame weapon.',
  'Heavy Stubber':      'Standard heavy stubber. Solid projectile weapons have +50% overpenetration.',
  'Stolen Auto Canon':  'Autocannon. High damage heavy weapon.',

  // ── Chain weapons ───────────────────────────────────────────────────────
  // Family passive: +25% critical damage. Axes also inflict bleeding.
  '[Mars] Chainaxe':      'Chainaxe. Axes have a special attack that inflicts bleeding. Chain weapons deal +25% critical damage.',
  'Rending Chainaxe':     'Chainaxe variant. Axes have a special attack that inflicts bleeding. Chain weapons deal +25% critical damage.',
  'Elite Chainsword':     'Chainsword variant. Chain weapons deal +25% critical damage.',
  'Scorpion Chainsword':  'Chainsword variant. Chain weapons deal +25% critical damage.',
  'Astartes Chainsword':  'Astartes chainsword. +10% critical hit chance. Chain weapons deal +25% critical damage.',
  '[Ryza] Astartes Chainsword': 'Astartes chainsword variant. +10% critical hit chance. Chain weapons deal +25% critical damage.',
  'Rusty Chainsaw':       'Improvised chain weapon. Chain weapons deal +25% critical damage.',

  // ── Power weapons ───────────────────────────────────────────────────────
  'Mastercrafted Power Maul': 'Master-crafted power maul. Standard power weapon.',
  'Power Axe':                'Power axe. Axes have a special attack that inflicts bleeding.',
  'Power Claymore':           '+10% parry chance. Hits reduce enemy Weapon Skill by −10.',
  'Thunder Hammer':           'Standard thunder hammer. Shock damage.',
  '[Mars-Pattern] Omnissian Axe': '+15 Weapon Skill bonus. Axes have a special attack that inflicts bleeding.',

  // ── Psyker / Navigator staves ───────────────────────────────────────────
  '[Mezoa Pattern]':           'Standard force weapon variant.',

  // ── Industrial (primitive melee) ────────────────────────────────────────
  '[LD] Industrial Hammer':  'Heavy industrial hammer. Primitive weapon.',
  'Industiral Hammer':       'Heavy industrial hammer. Primitive weapon.',
  'Weighty Axe':             'Heavy axe. Primitive weapon.',

  // ── Unique weapons ──────────────────────────────────────────────────────
  'Gift from Beyond the Grave': 'Unique weapon obtained from a special encounter.',
  'Unfading Valor':             'Unique weapon.',
  'Craven\'s Bane':             'Unique weapon.',
  'Staff of Orseillo Guardian': 'Staff associated with House Orseillo. Psyker weapon.',
  'Staff of House Orseillo':    'Staff of House Orseillo. Psyker weapon.',
  'Bloodhound Staff':           'Unique staff weapon.',
  'Inferno Pistol':             'Melta pistol. Effective at short range against heavily armoured targets.',
};

// ── Process each YAML file ───────────────────────────────────────────────────

let totalUpdated = 0;

for (const fname of fs.readdirSync(gearDir).filter(f => f.endsWith('.yml'))) {
  const fpath = path.join(gearDir, fname);
  const items = yaml.load(fs.readFileSync(fpath, 'utf8')) || [];
  let fileUpdated = 0;

  for (const item of items) {
    if (item.description) continue;           // already has one — skip
    const desc = DESCRIPTIONS[item.name];
    if (!desc) continue;                      // not in our table — skip
    item.description = desc;
    fileUpdated++;
    totalUpdated++;
    console.log(`  ✓ ${fname}: ${item.name}`);
  }

  if (fileUpdated > 0) {
    fs.writeFileSync(fpath, yaml.dump(items, { lineWidth: 120, quotingType: '"', forceQuotes: false }));
  }
}

console.log(`\nTotal updated: ${totalUpdated} items`);
