// ============= DEFINITIONS LOOKUP =============
const DEFS = DATA.definitions; // {talents, abilities, heroic}

const SKILL_STAT = new Set([
  'agility', 'strength', 'toughness', 'perception', 'fellowship', 'willpower', 'intelligence',
  'ballistic skill', 'weapon skill', 'medicae', 'commerce', 'lore imperium', 'lore xenos',
  'persuasion', 'coercion', 'logic', 'tech-use', 'awareness', 'athletics', 'demolition',
  'carouse', 'tracking', 'navigate warp',
]);

function normalize(s) {
  if (!s) return '';
  let n = s.toLowerCase()
    .replace(/[!*?]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  n = n.replace(/tacticical/g, 'tactical')
       .replace(/eagar/g, 'eager')
       .replace(/asssasin/g, 'assassin')
       .replace(/devestating/g, 'devastating')
       .replace(/versitility/g, 'versatility')
       .replace(/vesatility/g, 'versatility')
       .replace(/wilfire/g, 'wildfire')
       .replace(/wild fire/g, 'wildfire')
       .replace(/camraderie/g, 'camaraderie')
       .replace(/warefare/g, 'warfare')
       .replace(/proficeincy|profeciency|proficency/g, 'proficiency')
       .replace(/unyelding/g, 'unyielding')
       .replace(/ferver/g, 'fervor');
  return n;
}

// Build a single normalized index: norm -> {kind, originalName, description}
const _NORM_INDEX = (() => {
  const idx = {};
  for (const [name, desc] of Object.entries(DEFS.heroic || {})) {
    const n = normalize(name);
    if (!idx[n]) idx[n] = { kind: 'Heroic Action', name, desc };
  }
  for (const [name, desc] of Object.entries(DEFS.abilities || {})) {
    const n = normalize(name);
    if (!idx[n]) idx[n] = { kind: 'Ability', name, desc };
  }
  for (const [name, desc] of Object.entries(DEFS.talents || {})) {
    const n = normalize(name);
    if (!idx[n]) idx[n] = { kind: 'Talent', name, desc };
  }
  return idx;
})();

function isSkillStatPick(pick) {
  if (!pick) return false;
  const parts = pick.split('/').map(p => p.trim().toLowerCase().replace(/\s*\(.*?\)\s*/g, '').trim());
  if (parts.length === 0) return false;
  return parts.every(p =>
    SKILL_STAT.has(p) ||
    /^ap\s*[+-]?\d+$/.test(p) ||
    /^lore\s+/.test(p) ||
    /^characteristic\s+training/.test(p) ||
    /^base skill:/.test(p) ||
    p === '' || p === '-'
  );
}

function lookupOne(name) {
  if (!name) return null;
  const candidates = [name];
  // Strip trailing punct/whitespace
  let n = name.replace(/[*\s]+$/, '');
  if (n !== name) candidates.push(n);
  // Strip roman numeral upgrade tier
  const m = n.match(/^(.+?)\s+(I{1,4}|IV|V|VI{1,3}|IX|X)$/);
  let baseTier = null;
  if (m) {
    baseTier = m[1].trim();
    candidates.push(baseTier);
  }
  // Strip "Characteristic Training:" prefix
  const m2 = n.match(/^(?:Characteristic Training:?|Skill:?)\s*(.+)$/i);
  if (m2) candidates.push(m2[1].trim());
  
  for (const c of candidates) {
    const norm = normalize(c);
    if (_NORM_INDEX[norm]) {
      const hit = _NORM_INDEX[norm];
      // If we matched on a stripped tier, annotate
      if (baseTier && c === baseTier) {
        return { ...hit, displayName: name, tierStripped: true };
      }
      return { ...hit, displayName: name };
    }
  }
  return null;
}

function lookupPick(pick) {
  if (!pick) return [];
  const parts = pick.split('/').map(p => p.trim()).filter(Boolean);
  const out = [];
  const seen = new Set();
  for (const p of parts) {
    const r = lookupOne(p);
    if (r) {
      const key = r.name.toLowerCase();
      if (!seen.has(key)) { seen.add(key); out.push(r); }
    }
  }
  return out;
}

function pickHasInfo(pick) {
  if (!pick) return false;
  if (isSkillStatPick(pick)) return false;
  return lookupPick(pick).length > 0;
}

// ============= ARCHETYPE LOOKUP =============
// Each build records its three chosen archetypes (tier 1 / 2 / 3) directly
// in the source spreadsheet's "Talent" header row. We pull them through into
// the data bundle as DATA.archetypes.{mc,comp}[buildName] = {t1, t2, t3}.
// The player chooses tier-2 at level 16, tier-3 at level 36.

function getBuildArchetypes(buildName, isCompanion) {
  if (!DATA.archetypes) return null;
  const map = isCompanion ? DATA.archetypes.comp : DATA.archetypes.mc;
  return (map && map[buildName]) || null;
}

// Returns { archetype, tier } if levelNum is 16 or 36 and the build has the data, else null.
function archetypeCalloutAtLevel(levelNum, buildName, isCompanion) {
  const tier = (levelNum === 16) ? 2 : (levelNum === 36) ? 3 : null;
  if (!tier) return null;
  const a = getBuildArchetypes(buildName, isCompanion);
  if (!a) return null;
  const arch = (tier === 2) ? a.t2 : a.t3;
  if (!arch) return null;
  return { archetype: arch, tier };
}

// Returns the highest-tier archetype name that's been unlocked at `atLevel`.
// Falls back through t3 → t2 → t1 → baseArch.
function getActiveArchetype(buildName, isCompanion, atLevel, baseArch) {
  const a = getBuildArchetypes(buildName, isCompanion);
  if (a) {
    if (atLevel >= 36 && a.t3) return a.t3;
    if (atLevel >= 16 && a.t2) return a.t2;
    if (a.t1) return a.t1;
  }
  return baseArch;
}

// ============= GEAR DATABASE LOOKUP =============
function _normalizeGearName(s) {
  if (!s) return '';
  let n = s.toLowerCase()
    .replace(/\s*\[.*?\]\s*/g, ' ')      // strip [Origin] tags
    .replace(/[^a-z0-9 ]/g, '')           // strip punctuation
    .replace(/\s+/g, ' ').trim();
  return n;
}

const _GEAR_INDEX = (() => {
  const idx = {};
  for (const item of (DATA.gear_db || [])) {
    const nn = _normalizeGearName(item.n);
    if (!nn) continue;
    const keys = new Set([nn]);
    if (nn.endsWith('s') && nn.length > 4) keys.add(nn.slice(0, -1));
    keys.add(nn + 's');
    if (nn.startsWith('the ')) keys.add(nn.slice(4));
    for (const k of keys) {
      if (!idx[k]) idx[k] = item;
    }
  }
  return idx;
})();

// Look up a single gear option string. Returns the gear DB record, or null.
function lookupGear(rawOpt) {
  if (!rawOpt) return null;
  const cleaned = rawOpt.replace(/\s*\(.*?\)\s*$/, '').trim();
  const nn = _normalizeGearName(cleaned);
  if (!nn) return null;
  if (_GEAR_INDEX[nn]) return _GEAR_INDEX[nn];
  // Token-set fallback for fuzzy matches
  const optTokens = new Set(nn.split(' '));
  if (optTokens.size >= 2) {
    for (const [k, v] of Object.entries(_GEAR_INDEX)) {
      const kTokens = new Set(k.split(' '));
      if (kTokens.size < 2) continue;
      // All option tokens present in gear name (substring-style match)
      let allIn = true;
      for (const t of optTokens) { if (!kTokens.has(t)) { allIn = false; break; } }
      if (allIn) return v;
      // Or vice versa
      let allInRev = true;
      for (const t of kTokens) { if (!optTokens.has(t)) { allInRev = false; break; } }
      if (allInRev) return v;
    }
  }
  return null;
}

function actToText(a) {
  if (a == null) return '';
  if (a === 0) return 'Prologue';
  return `Act ${a}`;
}

// Get the extras (skills + gear) for a given build name.
function getExtrasForBuildName(buildName, isCompanion) {
  if (!DATA.extras) return null;
  const ex = isCompanion ? DATA.extras.comp_extras : DATA.extras.mc_extras;
  return (ex && ex[buildName]) || null;
}

// ============= DATA HELPERS =============
function getMCBuilds(theme) { return DATA.mc_builds.filter(b => b.theme === theme); }
function getMCThemes() {
  const out = []; const seen = new Set();
  DATA.mc_builds.forEach(b => { if (!seen.has(b.theme)) { seen.add(b.theme); out.push(b.theme); } });
  return out;
}
function getCurrentMC() {
  if (!config || !config.mc) return null;
  const builds = getMCBuilds(config.mc.theme);
  return builds[config.mc.buildIndex] || null;
}
function pickAt(buildObj, lvl) {
  if (!buildObj || !buildObj.levels) return null;
  return buildObj.levels[lvl] || null;
}
function getJoinLevel(charName) {
  if (config && config.joinLevels && config.joinLevels[charName] != null) return config.joinLevels[charName];
  return DEFAULT_JOIN_LEVELS[charName] || 1;
}
function getCompanionVariant(charName) {
  const variants = DATA.companions[charName];
  if (!variants) return null;
  const idx = (config && config.companions && config.companions[charName] != null) ? config.companions[charName] : 0;
  return variants[idx] || null;
}
function detectArchetype(origin) {
  if (!origin) return null;
  const archetypes = ['Officer','Warrior','Soldier','Operative','Bladedancer','Arch-Militant','Master Tactician','Vanguard','Assassin','Grand Strategist','Sniper','Heavy Gunner','Executioner','Exemplar'];
  for (const a of archetypes) {
    const re = new RegExp('\\b' + a.replace('-', '[- ]?') + '\\b', 'i');
    if (re.test(origin)) return a;
  }
  return null;
}
function initialsFor(name) {
  if (name === 'Rogue Trader') return 'RT';
  const parts = name.split(/[\s-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

