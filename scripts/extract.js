#!/usr/bin/env node
// One-time migration: splits the monolithic index.html into:
//   style.css           — all inline CSS
//   app.js              — all JS logic (DATA and PORTRAITS removed)
//   data/               — YAML source files for all game data
//
// After running this, use `npm run build` to regenerate data.js from the YAML files.

'use strict';

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

// ─── helpers ────────────────────────────────────────────────────────────────

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[()[\]{}]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function mkdirp(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeYaml(filePath, data) {
  mkdirp(path.dirname(filePath));
  fs.writeFileSync(filePath, yaml.dump(data, { lineWidth: 120, noRefs: true }));
}

// ─── 1. Extract CSS ──────────────────────────────────────────────────────────

const cssMatch = html.match(/<style>([\s\S]*?)<\/style>/);
if (!cssMatch) throw new Error('Could not find <style> block');
const css = cssMatch[1].replace(/^\n/, '').replace(/\n$/, '') + '\n';
fs.writeFileSync(path.join(ROOT, 'style.css'), css);
console.log('✓ style.css');

// ─── 2. Extract JS block ─────────────────────────────────────────────────────

const jsMatch = html.match(/<script>([\s\S]*?)<\/script>/);
if (!jsMatch) throw new Error('Could not find <script> block');
const jsBlock = jsMatch[1];

// ─── 3. Parse DATA ───────────────────────────────────────────────────────────

const dataLine = jsBlock.split('\n').find(l => l.startsWith('const DATA = '));
if (!dataLine) throw new Error('Could not find const DATA');
const DATA = JSON.parse(dataLine.slice('const DATA = '.length).replace(/;$/, ''));

// ─── 4. Parse PORTRAITS ──────────────────────────────────────────────────────

const lines = jsBlock.split('\n');
const pStart = lines.findIndex(l => l.trim().startsWith('const PORTRAITS = {'));
const pEnd   = lines.findIndex((l, i) => i > pStart && l.trim() === '};');
if (pStart === -1 || pEnd === -1) throw new Error('Could not find PORTRAITS block');
const portraitsCode = lines.slice(pStart, pEnd + 1).join('\n');
const PORTRAITS = new Function(portraitsCode + '\nreturn PORTRAITS;')(); // eslint-disable-line no-new-func

// ─── 5. Write app.js (strip DATA + PORTRAITS sections) ───────────────────────

{
  const out = [];
  let inPortraits = false;

  for (const line of lines) {
    if (line === '// ============= EMBEDDED DATA =============') continue;
    if (line.startsWith('const DATA = ')) continue;
    if (line === '// ============= PORTRAIT URLS =============') {
      inPortraits = true;
      continue;
    }
    if (inPortraits) {
      if (line.trim() === '};') inPortraits = false;
      continue;
    }
    out.push(line);
  }

  // Collapse leading blank lines
  while (out.length && out[0].trim() === '') out.shift();

  fs.writeFileSync(path.join(ROOT, 'app.js'), out.join('\n'));
  console.log('✓ app.js');
}

// ─── 6. Write data/portraits.yml ─────────────────────────────────────────────

const dataDir = path.join(ROOT, 'data');
writeYaml(path.join(dataDir, 'portraits.yml'), PORTRAITS);
console.log('✓ data/portraits.yml');

// ─── 7. Write data/definitions/ ──────────────────────────────────────────────

const defs = DATA.definitions;
writeYaml(path.join(dataDir, 'definitions', 'talents.yml'),   defs.talents   || {});
writeYaml(path.join(dataDir, 'definitions', 'abilities.yml'), defs.abilities || {});
writeYaml(path.join(dataDir, 'definitions', 'heroic.yml'),    defs.heroic    || {});
console.log('✓ data/definitions/ (talents, abilities, heroic)');

// ─── 8. Write data/gear/<slot>.yml ───────────────────────────────────────────

{
  const bySlot = {};
  for (const item of (DATA.gear_db || [])) {
    const slot = (item.s || 'other').toLowerCase().replace(/\s+/g, '-');
    if (!bySlot[slot]) bySlot[slot] = [];
    bySlot[slot].push({
      name:     item.n,
      slot:     item.s,
      location: item.l || null,
      act:      item.a != null ? item.a : null,
      description: item.d || null,
      ...(item.cat ? { category: item.cat } : {}),
    });
  }

  for (const [slot, items] of Object.entries(bySlot)) {
    writeYaml(path.join(dataDir, 'gear', `${slot}.yml`), items);
  }
  const slotNames = Object.keys(bySlot).join(', ');
  console.log(`✓ data/gear/ (${slotNames})`);
}

// ─── 9. Write MC build YAMLs ─────────────────────────────────────────────────

{
  const archetypesMC = (DATA.archetypes && DATA.archetypes.mc) || {};
  const extrasMC     = (DATA.extras && DATA.extras.mc_extras)  || {};

  // Group builds by theme, preserving original order within each theme
  const byTheme = {};
  for (const build of (DATA.mc_builds || [])) {
    if (!byTheme[build.theme]) byTheme[build.theme] = [];
    byTheme[build.theme].push(build);
  }

  for (const [theme, builds] of Object.entries(byTheme)) {
    const themeDir = path.join(dataDir, 'mc', slugify(theme));
    builds.forEach((build, idx) => {
      const num   = String(idx + 1).padStart(2, '0');
      const fname = `${num}-${slugify(build.name)}.yml`;

      const obj = {
        name:   build.name,
        theme:  build.theme,
        origin: build.origin || null,
        ...(archetypesMC[build.name] ? { archetypes: archetypesMC[build.name] } : {}),
        ...(extrasMC[build.name]     ? { extras:     extrasMC[build.name]     } : {}),
        levels: build.levels,
      };

      writeYaml(path.join(themeDir, fname), obj);
    });
    console.log(`✓ data/mc/${slugify(theme)}/ (${builds.length} builds)`);
  }
}

// ─── 10. Write companion build YAMLs ─────────────────────────────────────────

{
  const archetypesCOMP = (DATA.archetypes && DATA.archetypes.comp) || {};
  const extrasComp     = (DATA.extras && DATA.extras.comp_extras)  || {};

  for (const [charName, variants] of Object.entries(DATA.companions || {})) {
    const charDir = path.join(dataDir, 'companions', charName);
    variants.forEach((build, idx) => {
      const num   = String(idx + 1).padStart(2, '0');
      const fname = `${num}-${slugify(build.name)}.yml`;

      const obj = {
        name: build.name,
        ...(archetypesCOMP[build.name] ? { archetypes: archetypesCOMP[build.name] } : {}),
        ...(extrasComp[build.name]     ? { extras:     extrasComp[build.name]     } : {}),
        levels: build.levels,
      };

      writeYaml(path.join(charDir, fname), obj);
    });
    console.log(`✓ data/companions/${charName}/ (${variants.length} builds)`);
  }
}

console.log('\nDone. Run `npm run build` to regenerate data.js from the YAML files.');
