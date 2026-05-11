#!/usr/bin/env node
// Build step: reads all YAML source files under data/ and writes data.js.
// Run with `npm run build` whenever you edit YAML files.

'use strict';

const fs   = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const ROOT    = path.join(__dirname, '..');
const dataDir = path.join(ROOT, 'data');
const pkg     = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

function readYaml(filePath) {
  return yaml.load(fs.readFileSync(filePath, 'utf8'));
}

function globYaml(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.yml'))
    .sort()
    .map(f => path.join(dir, f));
}

// ─── portraits ───────────────────────────────────────────────────────────────

const PORTRAITS = readYaml(path.join(dataDir, 'portraits.yml'));

// ─── definitions ─────────────────────────────────────────────────────────────

const definitions = {
  talents:         readYaml(path.join(dataDir, 'definitions', 'talents.yml'))         || {},
  abilities:       readYaml(path.join(dataDir, 'definitions', 'abilities.yml'))       || {},
  heroic:          readYaml(path.join(dataDir, 'definitions', 'heroic.yml'))          || {},
  characteristics: readYaml(path.join(dataDir, 'definitions', 'characteristics.yml')) || {},
  dlcTags:         readYaml(path.join(dataDir, 'definitions', 'dlc-tags.yml'))        || {},
};

// ─── gear_db ─────────────────────────────────────────────────────────────────

const gearDir  = path.join(dataDir, 'gear');
const gear_db  = [];
// Files where every entry is DLC regardless of location text
const _gearFileDLC = {
  'shields.yml':   'Lex Imperialis',
  'familiars.yml': 'Lex Imperialis',
};
function detectGearDLC(item, fileName) {
  if (item.dlc) return item.dlc;
  if (_gearFileDLC[fileName]) return _gearFileDLC[fileName];
  const loc = item.location || '';
  if (/lex imperialis/i.test(loc)) return 'Lex Imperialis';
  if (/void shadows/i.test(loc))   return 'Void Shadows';
  return null;
}
for (const filePath of globYaml(gearDir)) {
  const fileName = path.basename(filePath);
  const items = readYaml(filePath) || [];
  for (const item of items) {
    const entry = { n: item.name, s: item.slot };
    if (item.location)    entry.l   = item.location;
    if (item.act != null) entry.a   = item.act;
    if (item.description) entry.d   = item.description;
    if (item.category)    entry.cat = item.category;
    const dlc = detectGearDLC(item, fileName);
    if (dlc) entry.dlc = dlc;
    gear_db.push(entry);
  }
}

// ─── MC builds ───────────────────────────────────────────────────────────────

const mc_builds = [];
const archetypesMC = {};
const extrasMC = {};

const mcRoot = path.join(dataDir, 'mc');
if (fs.existsSync(mcRoot)) {
  // Preserve theme order: alphabetical by theme dir, builds sorted by filename
  for (const themeDir of fs.readdirSync(mcRoot).sort()) {
    const themePath = path.join(mcRoot, themeDir);
    if (!fs.statSync(themePath).isDirectory()) continue;

    for (const filePath of globYaml(themePath)) {
      const b = readYaml(filePath);
      const mcBuild = {
        theme:  b.theme,
        name:   b.name,
        origin: b.origin || null,
        levels: b.levels || {},
      };
      if (b.dlc) mcBuild.dlc = b.dlc;
      mc_builds.push(mcBuild);
      if (b.archetypes) archetypesMC[b.name] = b.archetypes;
      if (b.extras)     extrasMC[b.name]     = b.extras;
    }
  }
}

// ─── companion builds ────────────────────────────────────────────────────────

const companions = {};
const archetypesCOMP = {};
const extrasComp = {};

const compRoot = path.join(dataDir, 'companions');
if (fs.existsSync(compRoot)) {
  // Companion order is defined by COMPANION_ORDER in app.js; we just load whatever dirs exist
  for (const charName of fs.readdirSync(compRoot).sort()) {
    const charPath = path.join(compRoot, charName);
    if (!fs.statSync(charPath).isDirectory()) continue;

    const variants = [];
    for (const filePath of globYaml(charPath)) {
      const b = readYaml(filePath);
      const variant = { name: b.name, levels: b.levels || {} };
      if (b.dlc) variant.dlc = b.dlc;
      variants.push(variant);
      if (b.archetypes) archetypesCOMP[b.name] = b.archetypes;
      if (b.extras)     extrasComp[b.name]     = b.extras;
    }
    if (variants.length) companions[charName] = variants;
  }
}

// ─── colonies ────────────────────────────────────────────────────────────────

const colonies = [];
const coloniesDir = path.join(dataDir, 'colonies');
for (const filePath of globYaml(coloniesDir)) {
  const c = readYaml(filePath);
  if (c && c.name) colonies.push(c);
}

// ─── vendors ─────────────────────────────────────────────────────────────────

const vendors = [];
let questRewards = [];
const vendorsDir = path.join(dataDir, 'vendors');
for (const filePath of globYaml(vendorsDir)) {
  const v = readYaml(filePath);
  if (!v) continue;
  if (path.basename(filePath) === 'quest-rewards.yml') {
    questRewards = v.items || [];
  } else if (v.name) {
    if (v.alignment_vendor) {
      vendors.push({
        name: v.name,
        alignment_vendor: true,
        neutral_items:    v.neutral_items    || [],
        dogmatic_items:   v.dogmatic_items   || [],
        iconoclast_items: v.iconoclast_items || [],
        heretic_items:    v.heretic_items    || [],
      });
    } else {
      vendors.push({ name: v.name, items: v.items || [] });
    }
  }
}

// ─── resources ───────────────────────────────────────────────────────────────

const resourcesDir = path.join(dataDir, 'resources');
const resourceSystems = fs.existsSync(path.join(resourcesDir, 'systems.yml'))
  ? (readYaml(path.join(resourcesDir, 'systems.yml')) || {}).systems || []
  : [];

// ─── assemble DATA ────────────────────────────────────────────────────────────

const DATA = {
  mc_builds,
  companions,
  definitions,
  gear_db,
  archetypes: { mc: archetypesMC, comp: archetypesCOMP },
  extras:     { mc_extras: extrasMC, comp_extras: extrasComp },
  colonies,
  vendors,
  questRewards,
  resourceSystems,
};

// ─── write data.js ────────────────────────────────────────────────────────────

const out = [
  '// Generated by `npm run build` — edit the YAML files in data/ instead.',
  `const APP_VERSION = ${JSON.stringify(pkg.version)};`,
  `const DATA = ${JSON.stringify(DATA)};`,
  `const PORTRAITS = ${JSON.stringify(PORTRAITS)};`,
  '',
].join('\n');

fs.writeFileSync(path.join(ROOT, 'data.js'), out);

// ─── write app.js (concatenate js/ source files) ────────────────────────────
const JS_FILES = [
  'js/core.js',
  'js/store.js',
  'js/choices.js',
  'js/lookup.js',
  'js/sheet.js',
  'js/tracker.js',
  'js/description.js',
  'js/catchup.js',
  'js/setup.js',
  'js/nav.js',
  'js/colonies.js',
  'js/traders.js',
  'js/notes.js',
  'js/resources.js',
  'js/init.js',
];
const appJs = JS_FILES.map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n\n');
fs.writeFileSync(path.join(ROOT, 'app.js'), appJs);
console.log(`✓ app.js   (${Math.round(Buffer.byteLength(appJs) / 1024)} KB, ${JS_FILES.length} modules)`);

// ─── update sw.js cache version ──────────────────────────────────────────────
const swPath = path.join(ROOT, 'sw.js');
const swSrc  = fs.readFileSync(swPath, 'utf8');
const swOut  = swSrc.replace(/const CACHE_VERSION = '[^']*';/, `const CACHE_VERSION = 'rt-tracker-${pkg.version}';`);
fs.writeFileSync(swPath, swOut);

const kb = Math.round(Buffer.byteLength(out) / 1024);
console.log(`✓ data.js  (${kb} KB)`);
console.log(`  mc_builds:    ${mc_builds.length}`);
console.log(`  companions:   ${Object.values(companions).reduce((s, v) => s + v.length, 0)} variants across ${Object.keys(companions).length} characters`);
console.log(`  gear_db:      ${gear_db.length} items`);
console.log(`  talents:      ${Object.keys(definitions.talents).length}`);
console.log(`  abilities:    ${Object.keys(definitions.abilities).length}`);
console.log(`  heroic:       ${Object.keys(definitions.heroic).length}`);
console.log(`  colonies:     ${colonies.length}`);
console.log(`  vendors:      ${vendors.reduce((s, v) => s + (v.items ? v.items.length : (v.neutral_items||[]).length + (v.dogmatic_items||[]).length + (v.iconoclast_items||[]).length + (v.heretic_items||[]).length), 0)} items across ${vendors.length} factions`);
console.log(`  questRewards: ${questRewards.length}`);
console.log(`  resources:    ${resourceSystems.length} systems`);
