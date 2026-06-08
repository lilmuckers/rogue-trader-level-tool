document.addEventListener('contextmenu', e => e.preventDefault());

const DEFAULT_JOIN_LEVELS = {"Abelard": 1, "Idira": 1, "Argenta": 3, "Pasqal": 6, "Cassia": 10, "Heinrix": 12, "Yrliet": 14, "Jae": 16, "Ulfar": 22, "Marazhai": 31, "Kibellah": 33, "Solomorne": 37, "Incendia Chorda": 40, "Calligos Winterscale": 40, "Uralon": 40};

const $ = (id) => document.getElementById(id);

const COMPANION_ARCH = {
  'Abelard': 'Warrior', 'Idira': 'Operative', 'Argenta': 'Soldier',
  'Cassia': 'Officer', 'Pasqal': 'Operative', 'Heinrix': 'Warrior',
  'Jae': 'Officer', 'Yrliet': 'Operative', 'Ulfar': 'Soldier',
  'Marazhai': 'Warrior', 'Kibellah': 'Bladedancer', 'Solomorne': 'Soldier',
  'Incendia Chorda': 'Soldier', 'Calligos Winterscale': 'Warrior', 'Uralon': 'Officer'
};
const COMPANION_ORDER = [
  'Abelard','Idira','Argenta','Cassia','Pasqal','Heinrix','Jae','Yrliet',
  'Ulfar','Marazhai','Kibellah','Solomorne','Incendia Chorda','Calligos Winterscale','Uralon'
];


// ============= STORAGE =============
const Store = (() => {
  let memory = {}; let useLS = false;
  try { localStorage.setItem('__t__','1'); localStorage.removeItem('__t__'); useLS = true; } catch (e) {}
  return {
    get(k) { if (useLS) { const v = localStorage.getItem(k); return v == null ? null : JSON.parse(v); } return k in memory ? memory[k] : null; },
    set(k, v) { if (useLS) localStorage.setItem(k, JSON.stringify(v)); else memory[k] = v; },
    remove(k) { if (useLS) localStorage.removeItem(k); else delete memory[k]; },
  };
})();

const KEY_CONFIG  = 'rt.config.v2';
const KEY_LEVEL   = 'rt.level.v1';
const KEY_CHOICES = 'rt.choices.v1';
const KEY_MC_NAME = 'rt.mc-name.v1';
const KEY_ROSTER  = 'rt.roster.v1';   // [{char, build, joinLevel}] ordered
const KEY_PARTY   = 'rt.party.v1';    // [charName] ordered, max 5
const MIN_LVL = 1, MAX_LVL = 55;
const MAX_PARTY = 5;


// ============= PICK CHOICES =============
// Storage format: { charName: { normalizedPickName: levelNumber } }
// levelNumber=0 means "taken, level unknown" (migrated from old array format)
function _migrateChoicesObj(raw) {
  if (!raw) return {};
  if (Array.isArray(raw)) return Object.fromEntries(raw.map(k => [k, 0]));
  return raw;
}
function getChoices(charName) {
  const all = Store.get(KEY_CHOICES) || {};
  return _migrateChoicesObj(all[charName]);
}
function isChoiceTaken(choices, pickName) {
  return normalize(pickName.trim()) in choices;
}
function getChoiceLevel(choices, pickName) {
  const key = normalize(pickName.trim());
  return key in choices ? choices[key] : null;
}
function markChoice(charName, pickName, atLevel) {
  const all = Store.get(KEY_CHOICES) || {};
  all[charName] = _migrateChoicesObj(all[charName]);
  all[charName][normalize(pickName.trim())] = atLevel != null ? atLevel : 0;
  Store.set(KEY_CHOICES, all);
}
function unmarkChoice(charName, pickName) {
  const all = Store.get(KEY_CHOICES) || {};
  all[charName] = _migrateChoicesObj(all[charName]);
  delete all[charName][normalize(pickName.trim())];
  Store.set(KEY_CHOICES, all);
}

// Appends styled span elements for a slash pick into containerEl.
function renderStyledPickText(rawPick, choices, atLevel, containerEl) {
  if (!rawPick) return;
  if (!rawPick.includes('/')) {
    containerEl.textContent = rawPick;
    return;
  }
  const parts = rawPick.split('/').map(p => p.trim()).filter(Boolean);
  const decidedAtLevel = atLevel != null && parts.some(p => getChoiceLevel(choices, p) === atLevel);

  parts.forEach((part, i) => {
    if (i > 0) {
      const sep = document.createElement('span');
      sep.textContent = ' / ';
      sep.className = 'pick-sep';
      containerEl.appendChild(sep);
    }
    const span = document.createElement('span');
    const choiceLevel = getChoiceLevel(choices, part);

    if (atLevel != null) {
      if (choiceLevel === atLevel) {
        span.className = 'pick-chosen';
      } else if (choiceLevel !== null) {
        span.className = 'pick-unavailable';
      } else if (decidedAtLevel) {
        span.className = 'pick-unchosen';
      }
    } else {
      if (choiceLevel !== null) span.className = 'pick-unavailable';
    }
    span.textContent = part;
    containerEl.appendChild(span);
  });
}

// Builds the choice-selection UI for a slash pick into targetEl.
function renderChoiceSection(rawPick, charName, atLevel, targetEl, isExtra) {
  const choices = getChoices(charName);
  const parts = rawPick.split('/').map(p => p.trim()).filter(Boolean);

  const section = document.createElement('div');
  section.className = 'choice-section';
  const lbl = document.createElement('div');
  lbl.className = 'choice-label';
  lbl.textContent = (isExtra ? '+ ' : '') + 'Choose one';
  section.appendChild(lbl);

  parts.forEach(part => {
    const isTaken = isChoiceTaken(choices, part);
    const opt = document.createElement('div');
    opt.className = 'choice-option' + (isTaken ? ' is-taken' : '');

    const nameEl = document.createElement('div');
    nameEl.className = 'choice-option-name';
    nameEl.textContent = part;
    opt.appendChild(nameEl);

    if (isSkillStatPick(part)) {
      const hit = lookupStatPick(part);
      const src = document.createElement('div');
      src.className = 'desc-source';
      src.textContent = hit ? hit.kind : 'Skill / Stat allocation';
      opt.appendChild(src);
      if (hit) {
        const txt = document.createElement('div');
        txt.className = 'desc-text';
        txt.textContent = hit.desc;
        opt.appendChild(txt);
      }
    } else {
      const hits = lookupPick(part);
      if (hits.length > 0) {
        const hit = hits[0];
        const src = document.createElement('div');
        src.className = 'desc-source';
        src.textContent = hit.kind;
        opt.appendChild(src);
        const badge = makeDlcBadge(hit.dlc);
        if (badge) opt.appendChild(badge);
        const txt = document.createElement('div');
        txt.className = 'desc-text';
        txt.textContent = hit.desc;
        opt.appendChild(txt);
      }
    }

    const btn = document.createElement('button');
    if (isTaken) {
      btn.className = 'choice-btn choice-btn-untake';
      btn.textContent = '✓ Taken - unmark';
      btn.addEventListener('click', () => { unmarkChoice(charName, part); renderTracker(); _renderTopOfStack(true); });
    } else {
      btn.className = 'choice-btn choice-btn-take';
      btn.textContent = 'Mark as taken';
      btn.addEventListener('click', () => { markChoice(charName, part, atLevel); renderTracker(); _renderTopOfStack(true); });
    }
    opt.appendChild(btn);
    section.appendChild(opt);
  });

  targetEl.appendChild(section);
}

// v1 → v2 config migration
(() => {
  if (Store.get(KEY_CONFIG)) return;
  const old = Store.get('rt.config.v1');
  if (old && old.mc && old.companions) {
    Store.set(KEY_CONFIG, { mc: old.mc, companions: old.companions, joinLevels: { ...DEFAULT_JOIN_LEVELS } });
    Store.remove('rt.config.v1');
  }
})();

// Roster helpers
function getRoster() { return Store.get(KEY_ROSTER) || []; }
function setRoster(r) { Store.set(KEY_ROSTER, r); }
function addToRoster(entry) { const r = getRoster(); r.push(entry); setRoster(r); }
function removeFromRoster(charName) { setRoster(getRoster().filter(e => e.char !== charName)); }
function rosterHas(charName) { return getRoster().some(e => e.char === charName); }

// Party helpers
function getParty() { return Store.get(KEY_PARTY) || []; }
function setParty(p) { Store.set(KEY_PARTY, p); }
function inParty(charName) { return getParty().includes(charName); }
function addToParty(charName) {
  const p = getParty();
  if (p.length >= MAX_PARTY || p.includes(charName)) return false;
  p.push(charName); setParty(p); return true;
}
function removeFromParty(charName) { setParty(getParty().filter(n => n !== charName)); }

// MC name
function getMCName() { return Store.get(KEY_MC_NAME) || ''; }
function setMCName(n) { Store.set(KEY_MC_NAME, n.trim()); }
function getMCDisplayName() {
  const n = getMCName();
  return n ? `${n} Von Valencius` : 'Rogue Trader';
}

let config = Store.get(KEY_CONFIG);
let level = Store.get(KEY_LEVEL) || 1;
if (level < MIN_LVL) level = MIN_LVL;
if (level > MAX_LVL) level = MAX_LVL;

// Roster migration: build KEY_ROSTER from legacy KEY_CONFIG on first run
(() => {
  if (Store.get(KEY_ROSTER)) return;
  const cfg = Store.get(KEY_CONFIG);
  if (!cfg || !cfg.companions) return;
  const roster = [];
  COMPANION_ORDER.forEach(charName => {
    if (cfg.companions[charName] == null) return;
    const variants = DATA.companions[charName];
    if (!variants) return;
    const build = (variants[cfg.companions[charName]] || variants[0]).name;
    const joinLevel = (cfg.joinLevels && cfg.joinLevels[charName]) || DEFAULT_JOIN_LEVELS[charName] || 1;
    roster.push({ char: charName, build, joinLevel });
  });
  Store.set(KEY_ROSTER, roster);
})();


// ============= DEFINITIONS LOOKUP =============
const DEFS = DATA.definitions; // {talents, abilities, heroic, characteristics}

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
// Normalized DLC tag map: normalize(name) → dlc string
const _DLC_TAGS = (() => {
  const m = {};
  for (const [name, dlc] of Object.entries(DEFS.dlcTags || {})) {
    m[normalize(name)] = dlc;
  }
  return m;
})();

const _NORM_INDEX = (() => {
  const idx = {};
  const tag = (name) => _DLC_TAGS[normalize(name)] || null;
  for (const [name, desc] of Object.entries(DEFS.heroic || {})) {
    const n = normalize(name);
    const dlc = tag(name);
    if (!idx[n]) idx[n] = { kind: 'Heroic Action', name, desc, ...(dlc ? {dlc} : {}) };
  }
  for (const [name, desc] of Object.entries(DEFS.abilities || {})) {
    const n = normalize(name);
    const dlc = tag(name);
    if (!idx[n]) idx[n] = { kind: 'Ability', name, desc, ...(dlc ? {dlc} : {}) };
  }
  for (const [name, desc] of Object.entries(DEFS.talents || {})) {
    const n = normalize(name);
    const dlc = tag(name);
    if (!idx[n]) idx[n] = { kind: 'Talent', name, desc, ...(dlc ? {dlc} : {}) };
  }
  for (const [name, desc] of Object.entries(DEFS.characteristics || {})) {
    const n = normalize(name);
    if (!idx[n]) idx[n] = { kind: 'Characteristic', name, desc };
  }
  return idx;
})();

// Look up a characteristic/skill description for stat allocation picks.
// Handles "Characteristic Training: X", "Base Skill: X", "Lore X", "AP +N" patterns.
function lookupStatPick(rawPick) {
  if (!rawPick) return null;
  const p = rawPick.trim();

  // AP +N → look up exact or strip to "AP +1" generic
  if (/^ap\s*\+?\d+$/i.test(p)) {
    const exact = _NORM_INDEX[normalize(p)];
    if (exact) return exact;
    return _NORM_INDEX['ap +1'] || null; // fallback to generic AP entry
  }

  // Characteristic Training: X → look up X
  const ctMatch = p.match(/^characteristic\s+training\s*:?\s*(.+)$/i);
  if (ctMatch) {
    const stat = ctMatch[1].trim();
    return _NORM_INDEX[normalize(stat)] || null;
  }

  // Base Skill: X → look up X
  const bsMatch = p.match(/^base\s+skill\s*:?\s*(.+)$/i);
  if (bsMatch) {
    const skill = bsMatch[1].trim();
    return _NORM_INDEX[normalize(skill)] || null;
  }

  // Direct lookup
  return _NORM_INDEX[normalize(p)] || null;
}

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
  if (isSkillStatPick(pick)) return lookupStatPick(pick) !== null;
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
    .replace(/'s\b/g, '')                 // strip possessives before punctuation removal
    .replace(/-/g, ' ')                   // hyphens → spaces (preserve word boundaries)
    .replace(/[^a-z0-9 ]/g, '')           // strip remaining punctuation
    .replace(/\s+/g, ' ').trim();
  // Common spelling variants
  n = n.replace(/\bbarreled\b/g, 'barrel')
       .replace(/\bhelmet\b/g, 'helm')
       .replace(/\bvengeance\b/g, 'vengance')
       .replace(/\bvengence\b/g, 'vengance');
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

// Creates a DLC badge element, or null if no DLC.
function makeDlcBadge(dlc) {
  if (!dlc) return null;
  const el = document.createElement('span');
  el.className = 'dlc-badge';
  el.textContent = dlc;
  return el;
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



// ============= BOTTOM SHEET =============
// Stack of {title, render} entries. The current view is at the top.
// Pushing adds a new view; popping returns to the previous one.
// The back button shows when stack length > 1.
let _sheetStack = [];

// Each stack entry: { title, render, node, scrollTop }
// `node` caches the rendered DOM so popping back restores exact state (tab
// selection, scroll position) without a re-render.
// Pass forceRender=true to bust the cache (e.g. after a choice is marked).
function _renderTopOfStack(forceRender = false) {
  if (_sheetStack.length === 0) return;
  const top = _sheetStack[_sheetStack.length - 1];
  $('sheet-title').textContent = top.title;
  const body = $('sheet-body');

  // Bust every entry's cache when state changes (e.g. pick choice marked)
  if (forceRender) _sheetStack.forEach(e => { e.node = null; e.scrollTop = 0; });

  if (!top.node) top.node = top.render();
  body.innerHTML = '';
  body.appendChild(top.node);
  body.scrollTop = top.scrollTop || 0;

  // Back button always hidden — X handles going back at every depth
  $('sheet-back').classList.add('hidden');
}

// Open a fresh sheet (resets the stack).
function openSheet(title, render) {
  _sheetStack = [{ title, render, node: null, scrollTop: 0 }];
  _renderTopOfStack();
  $('sheet-overlay').classList.add('open');
  $('sheet').classList.add('open');
  document.body.style.overflow = 'hidden';
}

// Push a new view. Saves the current scroll position so it's restored on pop.
function pushSheet(title, render) {
  if (_sheetStack.length > 0) {
    _sheetStack[_sheetStack.length - 1].scrollTop = $('sheet-body').scrollTop;
  }
  _sheetStack.push({ title, render, node: null, scrollTop: 0 });
  _renderTopOfStack();
}

// Pop the top view. Restores the cached DOM + scroll of the view below.
// At the bottom of the stack, closes the sheet entirely.
function popSheet() {
  if (_sheetStack.length <= 1) { closeSheet(); return; }
  _sheetStack.pop();
  _renderTopOfStack();
}

function closeSheet() {
  _sheetStack = [];
  $('sheet-overlay').classList.remove('open');
  const sh = $('sheet');
  sh.classList.remove('open');
  sh.classList.remove('note-editing');
  sh.style.height = '';
  sh.style.maxHeight = '';
  sh.style.bottom = '';
  $('sheet-back').classList.add('hidden');
  document.body.style.overflow = '';
}
// X always pops (closes sheet when at depth 1, goes back when deeper)
$('sheet-close').addEventListener('click', popSheet);
$('sheet-back').addEventListener('click', popSheet);
$('sheet-overlay').addEventListener('click', closeSheet);
// swipe-down to close (disabled when note editor is in edit mode)
(() => {
  let startY = null;
  const sheet = $('sheet');
  sheet.addEventListener('touchstart', (e) => {
    if (sheet.classList.contains('note-editing')) { startY = null; return; }
    const sb = $('sheet-body');
    if (sb.scrollTop > 0) { startY = null; return; }
    startY = e.touches[0].clientY;
  }, { passive: true });
  sheet.addEventListener('touchmove', (e) => {
    if (startY == null) return;
    const dy = e.touches[0].clientY - startY;
    if (dy > 0) sheet.style.transform = `translateY(${dy}px)`;
  }, { passive: true });
  sheet.addEventListener('touchend', (e) => {
    if (startY == null) return;
    const dy = (e.changedTouches[0].clientY - startY);
    sheet.style.transform = '';
    if (dy > 80) closeSheet();
    startY = null;
  });
})();


// ============= RENDER TRACKER =============
function renderTracker() {
  $('lvl-num').textContent = level;
  $('lvl-down').disabled = level <= MIN_LVL;
  $('lvl-up').disabled = level >= MAX_LVL;

  const rosterEl = $('roster');
  rosterEl.innerHTML = '';

  // MC
  const mc = getCurrentMC();
  if (mc) {
    rosterEl.appendChild(charCard({
      mc: true, key: 'Rogue Trader', displayName: getMCDisplayName(),
      buildName: mc.name, arch: detectArchetype(mc.origin) || '--',
      pick: pickAt(mc, level), available: true, build: mc,
    }));
  }

  const rosterData = getRoster();
  const party = getParty();

  // Party section
  const partyMembers = party.filter(n => rosterData.some(e => e.char === n));
  if (partyMembers.length) {
    const ph = document.createElement('div');
    ph.className = 'roster-heading';
    ph.textContent = '◆ Party ◆';
    rosterEl.appendChild(ph);
    partyMembers.forEach((charName, idx) => {
      const entry = rosterData.find(e => e.char === charName);
      if (!entry) return;
      rosterEl.appendChild(buildCompanionCard(entry, idx, 'party'));
    });
  }

  // Retinue section (non-party roster members)
  const retinue = rosterData.filter(e => !party.includes(e.char));
  const heading = document.createElement('div');
  heading.className = 'roster-heading';
  heading.textContent = '◆ Retinue ◆';
  rosterEl.appendChild(heading);

  retinue.forEach((entry, idx) => {
    rosterEl.appendChild(buildCompanionCard(entry, idx, 'retinue'));
  });

  // Add companion button
  const addBtn = document.createElement('button');
  addBtn.className = 'roster-add-btn';
  addBtn.textContent = '＋ Add Companion';
  addBtn.addEventListener('click', openAddCompanionSheet);
  rosterEl.appendChild(addBtn);
}

function buildCompanionCard(entry, idx, section) {
  const { char: charName, build: buildName, joinLevel } = entry;
  const variants = DATA.companions[charName];
  const variant = variants ? (variants.find(v => v.name === buildName) || variants[0]) : null;
  if (!variant) return document.createTextNode('');
  const available = level >= joinLevel;

  const wrap = document.createElement('div');
  wrap.className = 'roster-card-wrap';
  wrap.dataset.char = charName;
  wrap.dataset.section = section;

  // Drag handle
  const handle = document.createElement('div');
  handle.className = 'drag-handle';
  handle.innerHTML = '⠿';
  handle.setAttribute('aria-label', 'Drag to reorder');
  wrap.appendChild(handle);

  const card = charCard({
    mc: false, key: charName, displayName: charName,
    buildName: variant.name, arch: COMPANION_ARCH[charName] || '',
    pick: available ? pickAt(variant, level) : null,
    available, joinLevel, build: variant,
    isCompanion: true,
  });
  wrap.appendChild(card);

  // Attach drag-to-reorder on handle
  attachDragReorder(handle, wrap, section);
  // Swipe-left to delete (only when not in reorder mode)
  attachSwipeDelete(card, charName, wrap);
  return wrap;
}

function attachSwipeDelete(card, charName, wrap) {
  const DELETE_THRESHOLD = 100; // px to trigger delete
  let startX = 0, startY = 0, dx = 0, intentDecided = false, active = false;

  // Delete button revealed behind card
  const deleteBg = document.createElement('div');
  deleteBg.className = 'swipe-delete-bg';
  deleteBg.textContent = 'Remove';
  wrap.insertBefore(deleteBg, card); // behind card (card has z-index:1)

  const reset = (animate = true) => {
    if (animate) card.style.transition = 'transform 0.2s ease';
    card.style.transform = '';
    deleteBg.classList.remove('visible');
    setTimeout(() => { card.style.transition = ''; }, 220);
    active = false; intentDecided = false; dx = 0;
  };

  const doDelete = () => {
    card.style.transition = 'transform 0.2s ease, opacity 0.2s ease';
    card.style.transform = 'translateX(-100%)';
    card.style.opacity = '0';
    setTimeout(() => {
      removeFromRoster(charName);
      removeFromParty(charName);
      renderTracker();
    }, 200);
  };

  card.addEventListener('touchstart', (e) => {
    if (_reorderMode) return;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    dx = 0; intentDecided = false; active = false;
  }, { passive: true });

  card.addEventListener('touchmove', (e) => {
    if (_reorderMode) return;
    dx = e.touches[0].clientX - startX;
    const dy = e.touches[0].clientY - startY;
    if (!intentDecided) {
      if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
      if (Math.abs(dy) >= Math.abs(dx)) { intentDecided = true; return; } // vertical — ignore
      if (dx > 0) { intentDecided = true; return; } // swipe right — ignore
      intentDecided = true;
      active = true;
    }
    if (!active) return;
    card.style.transition = 'none';
    card.style.transform = `translateX(${Math.min(0, dx)}px)`;
    deleteBg.classList.toggle('visible', dx < -20);
  }, { passive: true });

  card.addEventListener('touchend', () => {
    if (!active) return;
    if (dx < -DELETE_THRESHOLD) {
      doDelete();
    } else {
      reset();
    }
  });

  card.addEventListener('touchcancel', () => reset(false));
  deleteBg.addEventListener('click', doDelete);
}

// ============= DRAG REORDER =============
function attachDragReorder(handle, wrap, section) {
  let startX = 0, startY = 0, startIdx = 0;
  let ghost = null, dragging = false, intentDecided = false;

  const cleanup = () => {
    if (ghost) { ghost.remove(); ghost = null; }
    wrap.classList.remove('dragging');
    $('roster').querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    dragging = false;
    intentDecided = false;
  };

  const startDrag = () => {
    dragging = true;
    wrap.classList.add('dragging');
    ghost = wrap.cloneNode(true);
    ghost.classList.add('drag-ghost');
    ghost.style.top = wrap.getBoundingClientRect().top + 'px';
    document.body.appendChild(ghost);
    const siblings = Array.from(wrap.parentElement.querySelectorAll(`.roster-card-wrap[data-section="${section}"]`));
    startIdx = siblings.indexOf(wrap);
  };

  handle.addEventListener('touchstart', (e) => {
    if (!_reorderMode) return; // only active in reorder mode
    e.preventDefault();
    e.stopPropagation();
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    intentDecided = false;
    dragging = false;
  }, { passive: false });

  handle.addEventListener('touchmove', (e) => {
    const dx = Math.abs(e.touches[0].clientX - startX);
    const dy = e.touches[0].clientY - startY;
    const adx = dx, ady = Math.abs(dy);

    // Decide intent on first significant movement
    if (!intentDecided && (adx > 5 || ady > 5)) {
      intentDecided = true;
      if (adx > ady) { cleanup(); return; } // horizontal swipe — abort
      startDrag();
    }
    if (!dragging) return;
    e.preventDefault();

    ghost.style.transform = `translateY(${dy}px)`;

    const rEl = $('roster');
    const siblings = Array.from(rEl.querySelectorAll(`.roster-card-wrap[data-section="${section}"]`));
    const fingerY = e.touches[0].clientY;
    let targetIdx = startIdx;
    siblings.forEach((el, i) => {
      if (el === wrap) return;
      const rect = el.getBoundingClientRect();
      if (fingerY > rect.top + rect.height / 2) targetIdx = i;
    });
    siblings.forEach(el => el.classList.remove('drag-over'));
    if (siblings[targetIdx] && siblings[targetIdx] !== wrap) {
      siblings[targetIdx].classList.add('drag-over');
    }
  }, { passive: false });

  handle.addEventListener('touchend', (e) => {
    if (!dragging) { cleanup(); return; }

    const rEl = $('roster');
    const siblings = Array.from(rEl.querySelectorAll(`.roster-card-wrap[data-section="${section}"]`));
    const fingerY = e.changedTouches[0].clientY;
    let targetIdx = startIdx;
    siblings.forEach((el, i) => {
      if (el === wrap) return;
      const rect = el.getBoundingClientRect();
      if (fingerY > rect.top + rect.height / 2) targetIdx = i;
    });

    cleanup();
    if (targetIdx === startIdx) return;

    if (section === 'party') {
      const p = getParty();
      const partyVisible = p.filter(n => getRoster().some(e => e.char === n));
      const moved = partyVisible.splice(startIdx, 1)[0];
      if (!moved) return;
      partyVisible.splice(targetIdx, 0, moved);
      setParty(partyVisible);
    } else {
      const r = getRoster();
      const retinue = r.filter(e => !getParty().includes(e.char));
      const moved = retinue.splice(startIdx, 1)[0];
      if (!moved) return; // safety: invalid index, abort
      retinue.splice(targetIdx, 0, moved);
      const partyEntries = r.filter(e => getParty().includes(e.char));
      setRoster([...partyEntries, ...retinue].filter(Boolean));
    }
    renderTracker();
  });

  handle.addEventListener('touchcancel', cleanup);
}

// ============= ADD COMPANION SHEET =============
function openAddCompanionSheet() {
  openSheet('Add Companion', () => buildAddCompanionContent());
}

function buildAddCompanionContent() {
  const wrap = document.createElement('div');
  wrap.className = 'add-comp-form';

  const added = new Set(getRoster().map(e => e.char));
  const available = COMPANION_ORDER.filter(n => !added.has(n) && DATA.companions[n]);

  if (!available.length) {
    const msg = document.createElement('div');
    msg.style.cssText = 'color:var(--ink-dim);padding:12px 0;';
    msg.textContent = 'All companions already added.';
    wrap.appendChild(msg);
    return wrap;
  }

  // ── Character dropdown ──
  const charLabel = document.createElement('div');
  charLabel.className = 'add-comp-section-label';
  charLabel.textContent = 'Character';
  const charSel = document.createElement('select');
  charSel.className = 'setup-select';
  available.forEach(charName => {
    const o = document.createElement('option');
    o.value = charName;
    o.textContent = `${charName}  ·  ${COMPANION_ARCH[charName] || ''}`;
    charSel.appendChild(o);
  });

  // ── Build dropdown ──
  const buildLabel = document.createElement('div');
  buildLabel.className = 'add-comp-section-label';
  buildLabel.textContent = 'Build';
  const buildSel = document.createElement('select');
  buildSel.className = 'setup-select';

  // ── Join level ──
  const joinLabel = document.createElement('div');
  joinLabel.className = 'add-comp-section-label';
  joinLabel.textContent = 'Joins at level';
  const joinInput = document.createElement('input');
  joinInput.type = 'number'; joinInput.min = 1; joinInput.max = 55;
  joinInput.className = 'add-comp-join-input';
  joinInput.style.userSelect = 'text'; joinInput.style.webkitUserSelect = 'text';

  // ── Buttons ──
  const partyFull = getParty().length >= MAX_PARTY;
  const btnRow = document.createElement('div');
  btnRow.className = 'add-comp-btn-row';

  const rosterBtn = document.createElement('button');
  rosterBtn.className = 'add-comp-confirm-btn';
  rosterBtn.textContent = 'Add to Roster';

  const partyBtn = document.createElement('button');
  partyBtn.className = 'add-comp-confirm-btn add-comp-party-btn';
  partyBtn.textContent = partyFull ? 'Party Full' : 'Add to Party';
  partyBtn.disabled = partyFull;

  btnRow.append(rosterBtn, partyBtn);

  // Update builds + join level when character changes
  const updateForChar = () => {
    const charName = charSel.value;
    const variants = DATA.companions[charName] || [];
    buildSel.innerHTML = '';
    variants.forEach((v, i) => {
      const o = document.createElement('option');
      o.value = i; o.textContent = v.name;
      buildSel.appendChild(o);
    });
    buildSel.disabled = variants.length <= 1;
    joinInput.value = DEFAULT_JOIN_LEVELS[charName] || 1;
  };
  charSel.addEventListener('change', updateForChar);
  updateForChar(); // init

  const getEntry = () => {
    const charName = charSel.value;
    const variants = DATA.companions[charName] || [];
    const build = (variants[parseInt(buildSel.value, 10)] || variants[0])?.name || '';
    const joinLevel = Math.max(1, Math.min(55, parseInt(joinInput.value, 10) || 1));
    return { char: charName, build, joinLevel };
  };

  rosterBtn.addEventListener('click', () => {
    addToRoster(getEntry());
    closeSheet();
    renderTracker();
  });

  partyBtn.addEventListener('click', () => {
    const entry = getEntry();
    addToRoster(entry);
    addToParty(entry.char);
    closeSheet();
    renderTracker();
  });

  wrap.append(charLabel, charSel, buildLabel, buildSel, joinLabel, joinInput, btnRow);
  return wrap;
}

function makePortrait(key) {
  const wrap = document.createElement('div');
  wrap.className = 'portrait';
  const url = PORTRAITS[key];
  if (url) {
    const img = document.createElement('img');
    img.alt = key; img.loading = 'lazy';
    img.referrerPolicy = 'no-referrer';
    img.onerror = () => {
      wrap.innerHTML = '';
      const fb = document.createElement('div');
      fb.className = 'portrait-fallback';
      fb.textContent = initialsFor(key);
      wrap.appendChild(fb);
    };
    img.src = url;
    wrap.appendChild(img);
  } else {
    const fb = document.createElement('div');
    fb.className = 'portrait-fallback';
    fb.textContent = initialsFor(key);
    wrap.appendChild(fb);
  }
  return wrap;
}

function charCard({mc, key, displayName, buildName, arch, pick, available, joinLevel, build}) {
  const choices = getChoices(displayName);
  const hasDisplay = pick && (pick.m || pick.e);

  const card = document.createElement('div');
  let cls = 'char-card';
  if (mc) cls += ' is-mc';
  if (!available) cls += ' unavailable';
  else if (!hasDisplay) cls += ' no-pick';
  card.className = cls;

  card.appendChild(makePortrait(key));

  const body = document.createElement('div');
  body.className = 'char-body';

  const row = document.createElement('div');
  row.className = 'char-row';
  const nameEl = document.createElement('div');
  nameEl.className = 'char-name';
  nameEl.textContent = displayName;
  const archEl = document.createElement('div');
  archEl.className = 'char-arch';
  archEl.textContent = getActiveArchetype(buildName, !mc, level, arch);
  row.appendChild(nameEl);
  row.appendChild(archEl);
  body.appendChild(row);

  if (buildName) {
    const bn = document.createElement('div');
    bn.className = 'char-build-name';
    bn.textContent = buildName;
    body.appendChild(bn);
  }
  if (build && build.dlc) {
    const dlcEl = document.createElement('div');
    dlcEl.className = 'dlc-badge';
    dlcEl.textContent = build.dlc;
    body.appendChild(dlcEl);
  }

  if (!available) {
    const u = document.createElement('div');
    u.className = 'char-unavailable';
    u.textContent = `Joins at level ${joinLevel}`;
    body.appendChild(u);
  } else if (hasDisplay) {
    if (pick.m) {
      const p = document.createElement('div');
      p.className = 'char-pick';
      if (pick.m.includes('/') || pickHasInfo(pick.m)) p.classList.add('has-info');
      renderStyledPickText(pick.m, choices, level, p);
      body.appendChild(p);
    }
    if (pick.e) {
      const e = document.createElement('div');
      e.className = 'char-extra';
      renderStyledPickText(pick.e, choices, level, e);
      body.appendChild(e);
    }
    // Archetype callout at L16 / L36
    const callout = archetypeCalloutAtLevel(level, buildName, !mc);
    if (callout) {
      const ac = document.createElement('div');
      ac.className = 'char-archetype-callout';
      ac.innerHTML = `<span class="ac-tag">Tier&nbsp;${callout.tier}&nbsp;archetype</span> <span class="ac-name">${callout.archetype}</span>`;
      body.appendChild(ac);
    }
  } else {
    const empty = document.createElement('div');
    empty.className = 'char-empty';
    empty.textContent = '- no pick at this level -';
    body.appendChild(empty);
  }

  card.appendChild(body);
  attachCardInteractions(card, { displayName, buildName, arch, pick, available, build, mc, joinLevel, isCompanion: !mc });
  return card;
}

// ============= CARD INTERACTIONS (tap vs long-press) =============
const LONG_PRESS_MS = 480;

function attachCardInteractions(card, ctx) {
  let pressTimer = null;
  let didLongPress = false;
  let startX = 0, startY = 0;
  const MOVE_CANCEL = 10; // pixels

  function clearTimer() {
    if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
    card.classList.remove('long-pressing');
  }

  function start(e) {
    didLongPress = false;
    const t = e.touches ? e.touches[0] : e;
    startX = t.clientX; startY = t.clientY;
    pressTimer = setTimeout(() => {
      didLongPress = true;
      card.classList.remove('long-pressing');
      // haptic feedback if available
      if (navigator.vibrate) try { navigator.vibrate(15); } catch (e) {}
      openCatchupSheet(ctx);
    }, LONG_PRESS_MS);
    setTimeout(() => {
      if (pressTimer) card.classList.add('long-pressing');
    }, 100);
  }

  function move(e) {
    if (!pressTimer) return;
    const t = e.touches ? e.touches[0] : e;
    if (Math.abs(t.clientX - startX) > MOVE_CANCEL || Math.abs(t.clientY - startY) > MOVE_CANCEL) {
      clearTimer();
    }
  }

  function end(e) {
    if (didLongPress) { clearTimer(); didLongPress = false; return; }
    if (pressTimer) {
      clearTimer();
      // short tap → open description sheet
      openDescriptionSheet(ctx);
    }
  }

  function cancel() { clearTimer(); didLongPress = false; }

  card.addEventListener('touchstart', start, { passive: true });
  card.addEventListener('touchmove', move, { passive: true });
  card.addEventListener('touchend', end);
  card.addEventListener('touchcancel', cancel);
  card.addEventListener('mousedown', start);
  card.addEventListener('mousemove', move);
  card.addEventListener('mouseup', end);
  card.addEventListener('mouseleave', cancel);
  // Prevent the iOS context menu on long-press of text
  card.addEventListener('contextmenu', (e) => e.preventDefault());
}


// ============= DESCRIPTION SHEET =============
function openDescriptionSheet(ctx, mode) {
  // mode: 'open' (default) starts a new sheet stack; 'push' adds on top.
  const { displayName, pick, available, joinLevel } = ctx;
  const title = `Level ${level} · ${displayName}`;
  const render = () => buildDescriptionContent(ctx);
  if (mode === 'push') pushSheet(title, render);
  else openSheet(title, render);
}

function buildDescriptionContent(ctx) {
  const { displayName, pick, available, joinLevel, buildName, mc } = ctx;
  const wrap = document.createElement('div');

  const meta = document.createElement('div');
  meta.className = 'desc-context';
  if (!available) {
    meta.textContent = `${displayName} - joins at level ${joinLevel}.`;
    wrap.appendChild(meta);
    const empty = document.createElement('div');
    empty.className = 'desc-text-missing';
    empty.textContent = 'No pick yet - character not in party.';
    wrap.appendChild(empty);
    return wrap;
  }
  if (!pick || (!pick.m && !pick.e)) {
    meta.textContent = `${displayName} has no pick at this level.`;
    wrap.appendChild(meta);
    return wrap;
  }

  meta.textContent = `Picks for ${displayName} at level ${level}`;
  wrap.appendChild(meta);

  const renderPickBlock = (rawPick, isExtra) => {
    if (!rawPick) return;
    // Slash pick → choice selector
    if (rawPick.includes('/')) {
      renderChoiceSection(rawPick, displayName, level, wrap, isExtra);
      return;
    }
    if (isSkillStatPick(rawPick)) {
      const hit = lookupStatPick(rawPick);
      const block = document.createElement('div');
      block.className = 'desc-block';
      const nm = document.createElement('div');
      nm.className = 'desc-name';
      nm.textContent = (isExtra ? '+ ' : '') + rawPick;
      const src = document.createElement('div');
      src.className = 'desc-source';
      src.textContent = hit ? hit.kind : 'Skill / Stat allocation';
      block.appendChild(nm); block.appendChild(src);
      const txt = document.createElement('div');
      txt.className = hit ? 'desc-text' : 'desc-text-missing';
      txt.textContent = hit ? hit.desc : 'A characteristic, skill, or AP allocation.';
      block.appendChild(txt);
      wrap.appendChild(block);
      return;
    }
    const hits = lookupPick(rawPick);
    if (hits.length === 0) {
      const block = document.createElement('div');
      block.className = 'desc-block';
      const nm = document.createElement('div');
      nm.className = 'desc-name';
      nm.textContent = (isExtra ? '+ ' : '') + rawPick;
      const txt = document.createElement('div');
      txt.className = 'desc-text-missing';
      txt.textContent = 'No description available in the source data.';
      block.appendChild(nm); block.appendChild(txt);
      wrap.appendChild(block);
      return;
    }
    hits.forEach((hit, i) => {
      const block = document.createElement('div');
      block.className = 'desc-block';
      const nm = document.createElement('div');
      nm.className = 'desc-name';
      nm.textContent = (isExtra && i === 0 ? '+ ' : '') + hit.name + (hit.tierStripped ? ` - ${rawPick}` : '');
      const src = document.createElement('div');
      src.className = 'desc-source';
      src.textContent = hit.kind;
      const txt = document.createElement('div');
      txt.className = 'desc-text';
      txt.textContent = hit.desc;
      block.appendChild(nm); block.appendChild(src);
      const badge = makeDlcBadge(hit.dlc);
      if (badge) block.appendChild(badge);
      block.appendChild(txt);
      wrap.appendChild(block);
    });
  };

  if (pick.m) renderPickBlock(pick.m, false);
  if (pick.e) renderPickBlock(pick.e, true);

  // Archetype callout at L16 / L36
  const callout = archetypeCalloutAtLevel(level, buildName, !mc);
  if (callout) {
    const ac = document.createElement('div');
    ac.className = 'char-archetype-callout';
    ac.style.marginTop = '14px';
    ac.innerHTML = `<span class="ac-tag">Tier&nbsp;${callout.tier}&nbsp;archetype</span> <span class="ac-name">${callout.archetype}</span>`;
    wrap.appendChild(ac);
  }

  return wrap;
}


// ============= CATCH-UP SHEET =============

// ── Stat Calculator ───────────────────────────────────────────────────────────
const _CHAR_MAP = {
  'weapon skill': 'WS',  'ws': 'WS',
  'ballistic skill': 'BS', 'bs': 'BS',
  'strength': 'STR',     'str': 'STR',
  'toughness': 'TGH',    'tgh': 'TGH',
  'agility': 'AGI',      'agi': 'AGI', 'agl': 'AGI',
  'perception': 'PER',   'per': 'PER',
  'fellowship': 'FEL',   'fel': 'FEL',
  'intelligence': 'INT', 'int': 'INT',
  'willpower': 'WILL',   'will': 'WILL',
};
const _CHAR_FULL = { WS:'Weapon Skill', BS:'Ballistic Skill', STR:'Strength', TGH:'Toughness', AGI:'Agility', PER:'Perception', FEL:'Fellowship', INT:'Intelligence', WILL:'Willpower' };
const _CHAR_ORDER = ['WS','BS','STR','TGH','AGI','PER','FEL','INT','WILL'];
const _SKILL_NAMES = new Set(['medicae','commerce','lore imperium','lore xenos','lore warp','persuasion','coercion','logic','tech-use','awareness','athletics','demolition','carouse','tracking','navigate warp']);

function _resolveCharAbbr(raw) {
  const lc = raw.toLowerCase().trim();
  // "characteristic training: X" pattern
  const ct = lc.match(/^characteristic\s+training\s*:?\s*(.+)$/);
  if (ct) return _CHAR_MAP[ct[1].trim()] || null;
  return _CHAR_MAP[lc] || null;
}

function _isSkillPick(raw) {
  const lc = raw.toLowerCase().trim();
  if (_SKILL_NAMES.has(lc)) return true;
  if (/^lore\s+/.test(lc)) return true;
  if (/^base\s+skill:?/.test(lc)) return true;
  return false;
}

function calcBuildStats(build, upToLevel) {
  const originBonuses = {}; // abbr → bonus (from origin text)
  const training = {};      // abbr → count of +5 picks
  let apGained = 0;
  const skillCounts = {};   // skill name → count

  // Parse origin bonuses: "BS +2 / Agility +2 / Fellowship +2"
  const origin = build.origin || '';
  for (const m of origin.matchAll(/([\w][\w\s]*?)\s*\+(\d+)/g)) {
    const abbr = _resolveCharAbbr(m[1].trim());
    if (abbr) originBonuses[abbr] = (originBonuses[abbr] || 0) + parseInt(m[2], 10);
  }

  // Walk levels
  for (let n = 1; n <= Math.min(upToLevel, 55); n++) {
    const entry = build.levels && build.levels[n];
    if (!entry) continue;
    [entry.m, entry.e].forEach(pick => {
      if (!pick) return;
      // Skip slash-choice picks (can't know which was taken)
      if (pick.includes('/')) return;
      // AP pick
      const apM = pick.match(/^ap\s*\+(\d+)$/i);
      if (apM) { apGained += parseInt(apM[1], 10); return; }
      // Characteristic
      const abbr = _resolveCharAbbr(pick);
      if (abbr) { training[abbr] = (training[abbr] || 0) + 1; return; }
      // Skill
      if (_isSkillPick(pick)) {
        const sk = pick.toLowerCase().trim().replace(/^base\s+skill:\s*/, '');
        skillCounts[sk] = (skillCounts[sk] || 0) + 1;
      }
    });
  }
  return { originBonuses, training, apGained, skillCounts };
}

function buildStatsPanel(ctx, upToLevel) {
  const { build, buildName, displayName, isCompanion } = ctx;
  const panel = document.createElement('div');
  panel.className = 'stats-panel';

  if (!build || !build.levels) {
    panel.textContent = 'No build data.';
    return panel;
  }

  const stats = calcBuildStats(build, upToLevel ?? 55);

  // Base stats for companions (when available)
  const baseStats = isCompanion
    ? (DATA.companionBaseStats && DATA.companionBaseStats[displayName]) || null
    : null;

  // Origin text (MC only)
  if (build.origin) {
    const originEl = document.createElement('div');
    originEl.className = 'stats-origin';
    originEl.textContent = build.origin;
    panel.appendChild(originEl);
  }

  // Disclaimer
  const disclaimer = document.createElement('div');
  disclaimer.className = 'stats-disclaimer';
  disclaimer.textContent = baseStats
    ? 'Base stats from character data. Training picks add +5 each. Gear and buffs not included.'
    : 'Shows gains from origin bonuses and training picks only — does not include homeworld, archetype starting bonuses, or gear.';
  panel.appendChild(disclaimer);

  // Characteristics table — always show all 9
  {
    const heading = document.createElement('div');
    heading.className = 'stats-heading';
    heading.textContent = baseStats
      ? `Characteristics at Level ${level}`
      : `Characteristic Gains at Level ${level}`;
    panel.appendChild(heading);

    const table = document.createElement('div');
    table.className = 'stats-table';

    // Header — different columns depending on whether we have base data
    const hdr = document.createElement('div');
    hdr.className = 'stats-row stats-header';
    const headers = baseStats
      ? ['Characteristic', 'Base', 'Training', 'Total']
      : ['Characteristic', 'Origin', 'Training', 'Total'];
    headers.forEach(h => {
      const c = document.createElement('div');
      c.className = 'stats-cell';
      c.textContent = h;
      hdr.appendChild(c);
    });
    table.appendChild(hdr);

    _CHAR_ORDER.forEach(abbr => {
      const base     = baseStats ? (baseStats[abbr] || 0) : (stats.originBonuses[abbr] || 0);
      const picks    = stats.training[abbr] || 0;
      const trainVal = picks * 5;
      const total    = base + trainVal;

      // Skip rows with nothing when we don't have base stats
      if (!baseStats && !base && !trainVal) return;

      const row = document.createElement('div');
      row.className = 'stats-row';

      const nameCell = document.createElement('div');
      nameCell.className = 'stats-cell stats-name';
      const abbrEl = document.createElement('span');
      abbrEl.className = 'stats-abbr';
      abbrEl.textContent = abbr;
      const fullEl = document.createElement('span');
      fullEl.className = 'stats-fullname';
      fullEl.textContent = _CHAR_FULL[abbr];
      nameCell.appendChild(abbrEl);
      nameCell.appendChild(fullEl);
      row.appendChild(nameCell);

      const col1 = baseStats ? String(base) : (base ? `+${base}` : '—');
      const col2 = trainVal ? `+${trainVal}` : '—';
      const col3 = baseStats ? String(total) : (total ? `+${total}` : '—');
      [col1, col2, col3].forEach((val, i) => {
        const c = document.createElement('div');
        c.className = 'stats-cell' + (i === 2 ? ' stats-total' : '');
        c.textContent = val;
        row.appendChild(c);
      });
      table.appendChild(row);
    });
    panel.appendChild(table);
  }

  // AP
  if (stats.apGained > 0) {
    const apRow = document.createElement('div');
    apRow.className = 'stats-ap-row';
    const apLabel = document.createElement('span');
    apLabel.textContent = 'Action Points gained';
    const apVal = document.createElement('span');
    apVal.className = 'stats-ap-val';
    apVal.textContent = `+${stats.apGained} AP`;
    apRow.appendChild(apLabel);
    apRow.appendChild(apVal);
    panel.appendChild(apRow);
  }

  // Skills
  const skillEntries = Object.entries(stats.skillCounts);
  if (skillEntries.length > 0) {
    const sh = document.createElement('div');
    sh.className = 'stats-heading';
    sh.textContent = 'Skill Picks';
    panel.appendChild(sh);
    const skillList = document.createElement('div');
    skillList.className = 'stats-skill-list';
    skillEntries.sort((a,b) => a[0].localeCompare(b[0])).forEach(([sk, cnt]) => {
      const pill = document.createElement('span');
      pill.className = 'stats-skill-pill';
      const skName = sk.replace(/^(.)/, c => c.toUpperCase());
      pill.textContent = cnt > 1 ? `${skName} ×${cnt}` : skName;
      skillList.appendChild(pill);
    });
    panel.appendChild(skillList);
  }

  return panel;
}
function openCatchupSheet(ctx) {
  const { displayName, build } = ctx;
  if (!build || !build.levels) return;
  openSheet(`${displayName} · Build Timeline`, () => buildCatchupContent(ctx));
}

function buildCatchupContent(ctx) {
  const { displayName, buildName, arch, build, mc, isCompanion } = ctx;
  const wrap = document.createElement('div');

  // Meta header
  const meta = document.createElement('div');
  meta.className = 'catchup-meta';
  const bn = document.createElement('div');
  bn.className = 'catchup-build-name';
  bn.textContent = buildName || '';
  meta.appendChild(bn);

  const archetypes = getBuildArchetypes(buildName, isCompanion);
  if (archetypes && (archetypes.t1 || archetypes.t2 || archetypes.t3)) {
    const path = document.createElement('div');
    path.className = 'catchup-archetype-path';
    const parts = [];
    if (archetypes.t1) parts.push(`<span class="ap-tier">${archetypes.t1}</span>`);
    if (archetypes.t2) parts.push(`<span class="ap-tier">${archetypes.t2}</span>`);
    if (archetypes.t3) parts.push(`<span class="ap-tier">${archetypes.t3}</span>`);
    path.innerHTML = parts.join('<span class="ap-arrow">→</span>');
    meta.appendChild(path);
  } else if (arch) {
    const ar = document.createElement('div');
    ar.className = 'catchup-archetype';
    ar.textContent = arch;
    meta.appendChild(ar);
  }
  if (build && build.dlc) {
    const dlcEl = document.createElement('div');
    dlcEl.className = 'dlc-badge dlc-badge-build';
    dlcEl.textContent = build.dlc;
    meta.appendChild(dlcEl);
  }
  wrap.appendChild(meta);

  // Party button (companions only)
  if (isCompanion && rosterHas(displayName)) {
    const partyBtn = document.createElement('button');
    const updatePartyBtn = () => {
      const inP = inParty(displayName);
      partyBtn.className = 'party-toggle-btn' + (inP ? ' in-party' : '');
      partyBtn.textContent = inP ? '★ In Party - Remove' : `☆ Add to Party${getParty().length >= MAX_PARTY ? ' (party full)' : ''}`;
      partyBtn.disabled = !inP && getParty().length >= MAX_PARTY;
    };
    updatePartyBtn();
    partyBtn.addEventListener('click', () => {
      if (inParty(displayName)) removeFromParty(displayName);
      else addToParty(displayName);
      updatePartyBtn();
      renderTracker();
    });
    wrap.appendChild(partyBtn);
  }

  // Tabs: Timeline (default) | Stats | Gear & Skills (if extras)
  const extras = getExtrasForBuildName(buildName, isCompanion);
  const hasExtras = extras && (extras.skills || (extras.gear && extras.gear.length));

  const tabBar = document.createElement('div');
  tabBar.className = 'tab-bar';
  const tabTimeline = document.createElement('button');
  tabTimeline.className = 'tab-btn active';
  tabTimeline.textContent = 'Timeline';
  const tabStats = document.createElement('button');
  tabStats.className = 'tab-btn';
  tabStats.textContent = 'Stats';
  tabBar.appendChild(tabTimeline);
  tabBar.appendChild(tabStats);

  const timelinePanel = document.createElement('div');
  timelinePanel.classList.add('tab-panel');
  const statsPanel = buildStatsPanel(ctx, level);
  statsPanel.classList.add('tab-panel', 'hidden');
  let gearPanel = null;

  if (hasExtras) {
    const tabGear = document.createElement('button');
    tabGear.className = 'tab-btn';
    tabGear.textContent = 'Gear & Skills';
    tabBar.appendChild(tabGear);

    gearPanel = document.createElement('div');
    gearPanel.classList.add('tab-panel', 'hidden');

    const allTabs   = [tabTimeline, tabStats, tabGear];
    const allPanels = [timelinePanel, statsPanel, gearPanel];
    const activate  = (i) => {
      allTabs.forEach((t, j) => t.classList.toggle('active', j === i));
      allPanels.forEach((p, j) => p.classList.toggle('hidden', j !== i));
    };
    tabTimeline.addEventListener('click', () => activate(0));
    tabStats.addEventListener('click',    () => activate(1));
    tabGear.addEventListener('click',     () => activate(2));
  } else {
    const activate = (i) => {
      [tabTimeline, tabStats].forEach((t, j) => t.classList.toggle('active', j === i));
      [timelinePanel, statsPanel].forEach((p, j) => p.classList.toggle('hidden', j !== i));
    };
    tabTimeline.addEventListener('click', () => activate(0));
    tabStats.addEventListener('click',    () => activate(1));
  }

  wrap.appendChild(tabBar);

  // === Timeline panel ===
  const choices = getChoices(displayName);
  for (let n = 1; n <= MAX_LVL; n++) {
    const entry = build.levels[n];
    if (!entry || (!entry.m && !entry.e)) continue;

    const item = document.createElement('div');
    item.className = 'timeline-item';
    if (n === level) item.classList.add('is-current');

    const lvlBox = document.createElement('div');
    lvlBox.className = 'timeline-level';
    const lvlNum = document.createElement('div');
    lvlNum.className = 'timeline-level-num';
    lvlNum.textContent = n;
    const lvlTag = document.createElement('div');
    lvlTag.className = 'timeline-level-tag';
    lvlTag.textContent = n === level ? 'NOW' : 'LVL';
    lvlBox.appendChild(lvlNum);
    lvlBox.appendChild(lvlTag);
    item.appendChild(lvlBox);

    const pickCol = document.createElement('div');
    pickCol.className = 'timeline-pick';

    const mHasInfo = entry.m && (entry.m.includes('/') || pickHasInfo(entry.m));
    const eHasInfo = entry.e && (entry.e.includes('/') || pickHasInfo(entry.e));
    if (mHasInfo || eHasInfo) {
      item.classList.add('has-info');
      item.addEventListener('click', () => pushLevelDescription(entry, displayName, n));
    }

    if (entry.m) {
      const m = document.createElement('div');
      m.className = 'timeline-main' + (mHasInfo ? ' has-info' : '');
      renderStyledPickText(entry.m, choices, n, m);
      pickCol.appendChild(m);
    }
    if (entry.e) {
      const ex = document.createElement('div');
      ex.className = 'timeline-extra' + (eHasInfo ? ' has-info' : '');
      renderStyledPickText(entry.e, choices, n, ex);
      pickCol.appendChild(ex);
    }
    const callout = archetypeCalloutAtLevel(n, buildName, isCompanion);
    if (callout) {
      const ac = document.createElement('div');
      ac.className = 'char-archetype-callout';
      ac.style.marginTop = '8px';
      ac.innerHTML = `<span class="ac-tag">Tier&nbsp;${callout.tier}&nbsp;archetype</span> <span class="ac-name">${callout.archetype}</span>`;
      pickCol.appendChild(ac);
    }
    item.appendChild(pickCol);
    timelinePanel.appendChild(item);
  }
  wrap.appendChild(timelinePanel);
  wrap.appendChild(statsPanel);

  // === Gear & Skills panel ===
  if (hasExtras && gearPanel) {
    if (extras.skills) {
      const panel = document.createElement('div');
      panel.className = 'extras-panel';
      const h = document.createElement('div');
      h.className = 'extras-heading';
      h.textContent = 'Skill Options';
      panel.appendChild(h);
      const s = document.createElement('div');
      s.className = 'skills-block';
      s.textContent = extras.skills;
      panel.appendChild(s);
      gearPanel.appendChild(panel);
    }
    if (extras.gear && extras.gear.length) {
      const panel = document.createElement('div');
      panel.className = 'extras-panel';
      const h = document.createElement('div');
      h.className = 'extras-heading';
      h.textContent = 'Gear to Consider';
      panel.appendChild(h);
      const list = document.createElement('div');
      list.className = 'gear-list';
      extras.gear.forEach(slot => {
        const row = document.createElement('div');
        row.className = 'gear-row';
        const slotLabel = document.createElement('div');
        slotLabel.className = 'gear-slot';
        slotLabel.textContent = slot.slot;
        row.appendChild(slotLabel);
        const optsCol = document.createElement('div');
        optsCol.className = 'gear-options';
        slot.options.split('/').map(o => o.trim()).filter(Boolean).forEach(opt => {
          const pill = document.createElement('span');
          pill.className = 'gear-pill';
          const cleaned = opt.replace(/\s*\(.*?\)\s*$/, '').trim();
          const found = lookupGear(cleaned);
          pill.textContent = opt;
          if (found && (found.l || found.a != null || found.d)) {
            if (found.a != null) {
              const loc = document.createElement('span');
              loc.className = 'gear-pill-loc';
              loc.textContent = '· ' + actToText(found.a);
              pill.appendChild(loc);
            }
            const gearBadge = makeDlcBadge(found.dlc);
            if (gearBadge) { gearBadge.className = 'dlc-badge dlc-badge-pill'; pill.appendChild(gearBadge); }
            pill.addEventListener('click', () => pushGearDetail(found, opt));
          } else {
            pill.classList.add('unknown');
          }
          optsCol.appendChild(pill);
        });
        row.appendChild(optsCol);
        list.appendChild(row);
      });
      panel.appendChild(list);
      gearPanel.appendChild(panel);
    }
    wrap.appendChild(gearPanel);
  }

  return wrap;
}

// Push a gear-detail sheet on top of the catch-up timeline
function pushGearDetail(gearItem, displayName) {
  pushSheet(gearItem.n || displayName, () => buildGearDetailContent(gearItem));
}

function buildGearDetailContent(gearItem) {
  const wrap = document.createElement('div');

  if (gearItem.dlc) {
    const dlcEl = document.createElement('div');
    dlcEl.className = 'dlc-badge dlc-badge-gear';
    dlcEl.textContent = gearItem.dlc;
    wrap.appendChild(dlcEl);
  }

  const detail = document.createElement('div');
  detail.className = 'gear-detail';

  if (gearItem.cat) {
    const r = document.createElement('div');
    r.className = 'gear-detail-row';
    const l = document.createElement('div');
    l.className = 'gear-detail-label';
    l.textContent = 'Category';
    const v = document.createElement('div');
    v.className = 'gear-detail-value';
    v.textContent = gearItem.cat;
    r.appendChild(l); r.appendChild(v); detail.appendChild(r);
  }

  if (gearItem.s && !gearItem.cat) {
    const r = document.createElement('div');
    r.className = 'gear-detail-row';
    const l = document.createElement('div');
    l.className = 'gear-detail-label';
    l.textContent = 'Slot';
    const v = document.createElement('div');
    v.className = 'gear-detail-value';
    v.textContent = gearItem.s.charAt(0).toUpperCase() + gearItem.s.slice(1);
    r.appendChild(l); r.appendChild(v); detail.appendChild(r);
  }

  if (gearItem.l) {
    const r = document.createElement('div');
    r.className = 'gear-detail-row';
    const l = document.createElement('div');
    l.className = 'gear-detail-label';
    l.textContent = 'Where';
    const v = document.createElement('div');
    v.className = 'gear-detail-value';
    v.textContent = gearItem.l;
    r.appendChild(l); r.appendChild(v); detail.appendChild(r);
  }

  if (gearItem.a != null) {
    const r = document.createElement('div');
    r.className = 'gear-detail-row';
    const l = document.createElement('div');
    l.className = 'gear-detail-label';
    l.textContent = 'When';
    const v = document.createElement('div');
    v.className = 'gear-detail-value';
    v.textContent = actToText(gearItem.a);
    r.appendChild(l); r.appendChild(v); detail.appendChild(r);
  }

  if (gearItem.d) {
    const r = document.createElement('div');
    r.className = 'gear-detail-row';
    const l = document.createElement('div');
    l.className = 'gear-detail-label';
    l.textContent = 'Effect';
    const v = document.createElement('div');
    v.className = 'gear-detail-value';
    v.textContent = gearItem.d;
    r.appendChild(l); r.appendChild(v); detail.appendChild(r);
  }

  if (!gearItem.l && gearItem.a == null && !gearItem.d) {
    const empty = document.createElement('div');
    empty.className = 'desc-text-missing';
    empty.textContent = 'No location or effect data found for this item.';
    detail.appendChild(empty);
  }

  wrap.appendChild(detail);
  return wrap;
}

function _renderPickBlock(rawPick, isExtra, wrap, displayName, atLevel) {
  if (!rawPick) return;
  if (rawPick.includes('/')) {
    renderChoiceSection(rawPick, displayName, atLevel, wrap, isExtra);
    return;
  }
  if (isSkillStatPick(rawPick)) {
    const hit = lookupStatPick(rawPick);
    const block = document.createElement('div');
    block.className = 'desc-block';
    const nm = document.createElement('div');
    nm.className = 'desc-name';
    nm.textContent = (isExtra ? '+ ' : '') + rawPick;
    const src = document.createElement('div');
    src.className = 'desc-source';
    src.textContent = hit ? hit.kind : 'Skill / Stat allocation';
    block.appendChild(nm); block.appendChild(src);
    const txt = document.createElement('div');
    txt.className = hit ? 'desc-text' : 'desc-text-missing';
    txt.textContent = hit ? hit.desc : 'A characteristic, skill, or AP allocation.';
    block.appendChild(txt);
    wrap.appendChild(block);
    return;
  }
  const hits = lookupPick(rawPick);
  if (hits.length === 0) {
    const block = document.createElement('div');
    block.className = 'desc-block';
    const nm = document.createElement('div');
    nm.className = 'desc-name';
    nm.textContent = (isExtra ? '+ ' : '') + rawPick;
    const txt = document.createElement('div');
    txt.className = 'desc-text-missing';
    txt.textContent = 'No description available.';
    block.appendChild(nm); block.appendChild(txt);
    wrap.appendChild(block);
    return;
  }
  hits.forEach((hit, i) => {
    const block = document.createElement('div');
    block.className = 'desc-block';
    const nm = document.createElement('div');
    nm.className = 'desc-name';
    nm.textContent = (isExtra && i === 0 ? '+ ' : '') + hit.name + (hit.tierStripped ? ` - ${rawPick}` : '');
    const src = document.createElement('div');
    src.className = 'desc-source';
    src.textContent = hit.kind;
    const txt = document.createElement('div');
    txt.className = 'desc-text';
    txt.textContent = hit.desc;
    block.appendChild(nm); block.appendChild(src);
    const b1 = makeDlcBadge(hit.dlc); if (b1) block.appendChild(b1);
    block.appendChild(txt);
    wrap.appendChild(block);
  });
}

// Push a combined level description (all picks for one level) — mirrors the
// main-screen description sheet so clicking a row shows everything at once.
function pushLevelDescription(entry, displayName, atLevel) {
  const title = `Level ${atLevel} · ${displayName}`;
  pushSheet(title, () => {
    const wrap = document.createElement('div');
    const meta = document.createElement('div');
    meta.className = 'desc-context';
    meta.textContent = `${displayName} · level ${atLevel}`;
    wrap.appendChild(meta);

    _renderPickBlock(entry.m, false, wrap, displayName, atLevel);
    _renderPickBlock(entry.e, true, wrap, displayName, atLevel);
    return wrap;
  });
}

// Push a single-pick description on top of whatever's currently open.
// Used both from the catch-up timeline (where back returns to the timeline)
// and could be used elsewhere for the same nesting pattern.
function pushSinglePickDescription(rawPick, displayName, atLevel) {
  pushSheet(rawPick, () => buildSinglePickContent(rawPick, displayName, atLevel));
}

function buildSinglePickContent(rawPick, displayName, atLevel) {
  const wrap = document.createElement('div');
  const meta = document.createElement('div');
  meta.className = 'desc-context';
  meta.textContent = `${displayName} · level ${atLevel}`;
  wrap.appendChild(meta);

  _renderPickBlock(rawPick, false, wrap, displayName, atLevel);
  return wrap;
}


// ============= SETUP =============
function renderSetup() {
  // MC name
  const nameInput = $('mc-name-input');
  nameInput.value = getMCName();

  // MC theme/build
  const themeSel = $('mc-theme-select');
  themeSel.innerHTML = '';
  const themes = getMCThemes();
  const curTheme = (config && config.mc) ? config.mc.theme : 'Commissar';
  themes.forEach(t => {
    const o = document.createElement('option');
    o.value = t; o.textContent = t;
    if (t === curTheme) o.selected = true;
    themeSel.appendChild(o);
  });
  populateBuildSelect(themeSel.value);
  themeSel.onchange = () => populateBuildSelect(themeSel.value);

  // Companion list (read-only summary in setup — managed via + button on main screen)
  const cWrap = $('companion-selects');
  cWrap.innerHTML = '';
  const roster = getRoster();
  roster.forEach(({ char: charName, build: buildName, joinLevel }) => {
    const row = document.createElement('div');
    row.className = 'setup-row companion-setup-row';
    row.style.cssText = 'display:flex;align-items:center;gap:8px;';
    const info = document.createElement('span');
    info.className = 'setup-label';
    info.style.flex = '1';
    info.textContent = `${charName} · ${buildName} · Lv ${joinLevel}`;
    const removeBtn = document.createElement('button');
    removeBtn.className = 'companion-remove-btn';
    removeBtn.textContent = '✕';
    removeBtn.title = `Remove ${charName}`;
    removeBtn.addEventListener('click', () => {
      removeFromRoster(charName);
      removeFromParty(charName);
      renderSetup();
      renderTracker();
    });
    row.append(info, removeBtn);
    cWrap.appendChild(row);
  });

  $('cancel-setup-btn').classList.toggle('hidden', !config);
  $('reset-btn').classList.toggle('hidden', !config);
}

function populateBuildSelect(theme) {
  const buildSel = $('mc-build-select');
  buildSel.innerHTML = '';
  const builds = getMCBuilds(theme);
  let curIdx = 0;
  if (config && config.mc && config.mc.theme === theme) curIdx = config.mc.buildIndex;
  else if (theme === 'Commissar') {
    const tc = builds.findIndex(b => /taking command/i.test(b.name));
    if (tc >= 0) curIdx = tc;
  }
  builds.forEach((b, i) => {
    const o = document.createElement('option');
    o.value = i; o.textContent = b.name;
    if (i === curIdx) o.selected = true;
    buildSel.appendChild(o);
  });
}


// ============= SECTION NAVIGATION =============
let _activeSection = 'tracker';
let _reorderMode = false;

function setReorderMode(on) {
  _reorderMode = on;
  $('roster').classList.toggle('reorder-active', on);
  const btn = $('reorder-btn');
  if (btn) {
    btn.textContent = on ? '✓ Done' : '⇅ Reorder';
    btn.classList.toggle('active', on);
  }
}

const SECTION_META = {
  tracker:   { title: 'Rogue Trader',    subtitle: 'Level Tracker & Build Companion' },
  colony:    { title: 'Holdings', subtitle: 'Colonies &amp; Voidship upgrades' },
  traders:   { title: 'Traders',         subtitle: 'Faction reputations & available items' },
  reference: { title: 'Reference',       subtitle: 'Lookup tables & reference data' },
  notes:     { title: 'Notes',           subtitle: 'Campaign notes & reminders' },
  workshop:  { title: 'Workshop',        subtitle: 'Custom build manager' },
};

function showSection(name) {
  if (name !== 'tracker') setReorderMode(false);
  _activeSection = name;
  document.querySelectorAll('.section-view').forEach(el => el.classList.add('hidden'));
  $(`${name}-view`).classList.remove('hidden');
  $('setup-view').classList.add('hidden');
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.section === name);
  });
  const meta = SECTION_META[name] || {};
  $('section-title').textContent  = meta.title    || 'Rogue Trader';
  $('section-subtitle').textContent = meta.subtitle || '';
  if (name === 'tracker')        renderTracker();
  else if (name === 'colony')    renderColonySection();
  else if (name === 'traders')   renderTradersSection();
  else if (name === 'reference') { _referenceSubSection = null; renderReferenceSection(); }
  else if (name === 'notes')     renderNotesSection();
  else if (name === 'workshop')  { _wsStep = 'manager'; renderWorkshopSection(); }
}

document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => showSection(btn.dataset.section));
});

function showTracker() { showSection('tracker'); }
function showSetup() {
  document.querySelectorAll('.section-view').forEach(el => el.classList.add('hidden'));
  $('setup-view').classList.remove('hidden');
  renderSetup();
}


$('lvl-up').addEventListener('click', () => { if (level < MAX_LVL) { level++; Store.set(KEY_LEVEL, level); renderTracker(); } });
$('lvl-down').addEventListener('click', () => { if (level > MIN_LVL) { level--; Store.set(KEY_LEVEL, level); renderTracker(); } });
function jumpPrompt() {
  const input = prompt('Set level (1-55):', level);
  if (input == null) return;
  const n = parseInt(input, 10);
  if (!isNaN(n) && n >= MIN_LVL && n <= MAX_LVL) { level = n; Store.set(KEY_LEVEL, level); renderTracker(); }
}
$('lvl-num').addEventListener('click', jumpPrompt);
$('goto-50-btn').addEventListener('click', jumpPrompt);
$('edit-setup-btn').addEventListener('click', showSetup);
$('reorder-btn').addEventListener('click', () => setReorderMode(!_reorderMode));
$('cancel-setup-btn').addEventListener('click', () => { if (config) showTracker(); });
$('add-companion-btn').addEventListener('click', openAddCompanionSheet);
$('save-btn').addEventListener('click', () => {
  const name = ($('mc-name-input').value || '').trim();
  setMCName(name);
  const theme = $('mc-theme-select').value;
  const buildIndex = parseInt($('mc-build-select').value, 10);
  config = { mc: { theme, buildIndex }, companions: {}, joinLevels: {} };
  Store.set(KEY_CONFIG, config);
  showTracker();
});
$('reset-btn').addEventListener('click', () => {
  if (!confirm('Erase your saved roster, join levels, and current level?')) return;
  Store.remove(KEY_CONFIG); Store.remove(KEY_LEVEL);
  Store.remove(KEY_MC_NAME); Store.remove(KEY_ROSTER); Store.remove(KEY_PARTY);
  config = null; level = 1;
  showSetup();
});
// Close sheet with ESC (or pop back if drilled in)
window.addEventListener('keydown', (e) => { if (e.key === 'Escape') popSheet(); });

if (!config) showSetup(); else showTracker();


// ============= HOLDINGS: COLONIES + VOIDSHIP =============

// ── Persistence ────────────────────────────────────────────────────────────────
const KEY_COLONY_DONE    = 'rt.colony-done.v1';
const KEY_COLONY_LEVEL   = 'rt.colony-level.v1';
const KEY_VOIDSHIP_DONE  = 'rt.voidship-done.v1';
const KEY_HOLDINGS_TAB   = 'rt.holdings-tab.v1';

function getColonyDone(colonyName) {
  return (Store.get(KEY_COLONY_DONE) || {})[colonyName] || {};
}
function toggleColonyProject(colonyName, projectName) {
  const all = Store.get(KEY_COLONY_DONE) || {};
  if (!all[colonyName]) all[colonyName] = {};
  if (all[colonyName][projectName]) delete all[colonyName][projectName];
  else all[colonyName][projectName] = true;
  Store.set(KEY_COLONY_DONE, all);
}
function getColonyLevel(colonyName) {
  return (Store.get(KEY_COLONY_LEVEL) || {})[colonyName] || 1;
}
function setColonyLevel(colonyName, newLevel) {
  const all = Store.get(KEY_COLONY_LEVEL) || {};
  all[colonyName] = Math.max(1, Math.min(5, newLevel));
  Store.set(KEY_COLONY_LEVEL, all);
}

function getVoidshipDone() {
  return Store.get(KEY_VOIDSHIP_DONE) || {};
}
function toggleVoidshipUpgrade(tierLabel, upgradeName) {
  const all = Store.get(KEY_VOIDSHIP_DONE) || {};
  const key = tierLabel + '::' + upgradeName;
  if (all[key]) delete all[key];
  else all[key] = true;
  Store.set(KEY_VOIDSHIP_DONE, all);
}
function isVoidshipUpgradeDone(tierLabel, upgradeName) {
  return !!(Store.get(KEY_VOIDSHIP_DONE) || {})[tierLabel + '::' + upgradeName];
}

function getHoldingsTab() { return Store.get(KEY_HOLDINGS_TAB) || 'colonies'; }
function setHoldingsTab(t) { Store.set(KEY_HOLDINGS_TAB, t); }

let _selectedColony = 0;

// ── Main render ────────────────────────────────────────────────────────────────
function renderColonySection() {
  const el = $('colony-content');
  el.innerHTML = '';

  // Tab bar
  const tabBar = document.createElement('div');
  tabBar.className = 'holdings-tab-bar';
  const activeTab = getHoldingsTab();

  const tabs = [
    { id: 'colonies', label: 'Colonies' },
    { id: 'voidship', label: 'Voidship' },
  ];
  tabs.forEach(({ id, label }) => {
    const btn = document.createElement('button');
    btn.className = 'holdings-tab-btn' + (activeTab === id ? ' active' : '');
    btn.textContent = label;
    btn.addEventListener('click', () => {
      setHoldingsTab(id);
      renderColonySection();
    });
    tabBar.appendChild(btn);
  });
  el.appendChild(tabBar);

  if (activeTab === 'colonies') {
    renderColoniesTab(el);
  } else {
    renderVoidshipTab(el);
  }
}

// ── Colonies tab ───────────────────────────────────────────────────────────────
function renderColoniesTab(el) {
  if (!DATA.colonies || !DATA.colonies.length) {
    const em = document.createElement('div');
    em.className = 'gb-empty';
    em.textContent = 'No colony data available.';
    el.appendChild(em);
    return;
  }
  const colony = DATA.colonies[_selectedColony];
  const colonyLevel = getColonyLevel(colony.name);
  const done = getColonyDone(colony.name);

  // Colony selector + level stepper
  const selectorWrap = document.createElement('div');
  selectorWrap.className = 'colony-selector-wrap';

  const sel = document.createElement('select');
  sel.className = 'colony-select';
  DATA.colonies.forEach((c, i) => {
    const o = document.createElement('option');
    o.value = i; o.textContent = c.name; o.selected = i === _selectedColony;
    sel.appendChild(o);
  });
  sel.addEventListener('change', () => { _selectedColony = parseInt(sel.value, 10); renderColonySection(); });
  selectorWrap.appendChild(sel);

  const levelWrap = document.createElement('div');
  levelWrap.className = 'colony-level-wrap';
  const levelLabel = document.createElement('span');
  levelLabel.className = 'colony-level-label';
  levelLabel.textContent = 'Level';
  const btnDown = document.createElement('button');
  btnDown.className = 'colony-level-btn'; btnDown.textContent = '−';
  btnDown.addEventListener('click', () => { setColonyLevel(colony.name, colonyLevel - 1); renderColonySection(); });
  const levelNum = document.createElement('span');
  levelNum.className = 'colony-level-num'; levelNum.textContent = colonyLevel;
  const btnUp = document.createElement('button');
  btnUp.className = 'colony-level-btn'; btnUp.textContent = '+';
  btnUp.addEventListener('click', () => { setColonyLevel(colony.name, colonyLevel + 1); renderColonySection(); });
  levelWrap.append(levelLabel, btnDown, levelNum, btnUp);
  selectorWrap.appendChild(levelWrap);
  el.appendChild(selectorWrap);

  // Project levels
  const levels = colony.levels || {};
  for (const lvlStr of Object.keys(levels).sort((a, b) => a - b)) {
    const lvl = parseInt(lvlStr, 10);
    const projects = levels[lvlStr];
    const isCurrent = lvl === colonyLevel;
    const isFuture  = lvl > colonyLevel;
    const isPast    = lvl < colonyLevel;

    const section = document.createElement('div');
    section.className = 'colony-level-section';

    const heading = document.createElement('div');
    heading.className = 'colony-level-heading' +
      (isCurrent ? ' is-current' : isPast ? ' is-past' : ' is-future');
    heading.textContent = `Level ${lvl}`;
    section.appendChild(heading);

    for (const project of (projects || [])) {
      const isDone = !!done[project.name];
      const card = document.createElement('div');
      card.className = 'colony-project' +
        (isDone ? ' is-done' : '') +
        (isFuture ? ' is-future' : '') +
        (isPast && !isDone ? ' is-past-uncomplete' : '');

      const header = document.createElement('div');
      header.className = 'colony-project-header';
      const check = document.createElement('div');
      check.className = 'colony-project-check';
      check.textContent = isDone ? '✓' : '';
      const nameEl = document.createElement('div');
      nameEl.className = 'colony-project-name';
      nameEl.textContent = project.name;
      header.append(check, nameEl);
      card.appendChild(header);

      if (!isFuture) {
        check.addEventListener('click', (e) => {
          e.stopPropagation();
          toggleColonyProject(colony.name, project.name);
          renderColonySection();
        });
        nameEl.style.cursor = 'pointer';
        card.addEventListener('click', (e) => {
          if (check.contains(e.target)) return;
          openSheet(project.name, () => {
            const wrap = document.createElement('div');
            wrap.className = 'colony-project-detail-sheet';
            if (project.cost && project.cost !== 'None') {
              const row = document.createElement('div');
              row.className = 'colony-project-row';
              row.innerHTML = `<strong>Cost:</strong> ${project.cost}`;
              wrap.appendChild(row);
            }
            if (project.benefit) {
              const row = document.createElement('div');
              row.className = 'colony-project-row';
              row.innerHTML = `<strong>Reward:</strong> ${project.benefit}`;
              wrap.appendChild(row);
            }
            if (!project.cost && !project.benefit) {
              const row = document.createElement('div');
              row.className = 'colony-project-row';
              row.textContent = 'No details available.';
              wrap.appendChild(row);
            }
            return wrap;
          });
        });
      }
      section.appendChild(card);
    }
    el.appendChild(section);
  }
}

// ── Voidship tab ───────────────────────────────────────────────────────────────
function renderVoidshipTab(el) {
  const ships = DATA.voidshipUpgrades || [];
  if (!ships.length) {
    const em = document.createElement('div');
    em.className = 'gb-empty';
    em.textContent = 'No voidship data available.';
    el.appendChild(em);
    return;
  }

  const ship = ships[0]; // single ship for now
  const tiers = ship.tiers || [];

  // Progress summary
  const allUpgrades = tiers.flatMap(t => (t.upgrades || []).map(u => ({ tier: t.label, name: u.name })));
  const doneCount = allUpgrades.filter(u => isVoidshipUpgradeDone(u.tier, u.name)).length;
  const summary = document.createElement('div');
  summary.className = 'voidship-summary';
  summary.textContent = `${ship.name} · ${doneCount} / ${allUpgrades.length} upgrades installed`;
  el.appendChild(summary);

  tiers.forEach(tier => {
    const tierDone = (tier.upgrades || []).filter(u => isVoidshipUpgradeDone(tier.label, u.name)).length;
    const section = document.createElement('div');
    section.className = 'colony-level-section';

    const heading = document.createElement('div');
    heading.className = 'colony-level-heading' + (tierDone === tier.upgrades.length ? ' is-past' : ' is-current');
    heading.textContent = `${tier.label} (${tierDone}/${tier.upgrades.length})`;
    section.appendChild(heading);

    (tier.upgrades || []).forEach(upgrade => {
      const isDone = isVoidshipUpgradeDone(tier.label, upgrade.name);
      const card = document.createElement('div');
      card.className = 'colony-project' + (isDone ? ' is-done' : '');

      const header = document.createElement('div');
      header.className = 'colony-project-header';
      const check = document.createElement('div');
      check.className = 'colony-project-check';
      check.textContent = isDone ? '✓' : '';
      const nameEl = document.createElement('div');
      nameEl.className = 'colony-project-name';
      nameEl.textContent = upgrade.name;
      header.append(check, nameEl);
      card.appendChild(header);

      check.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleVoidshipUpgrade(tier.label, upgrade.name);
        renderColonySection();
      });

      card.addEventListener('click', (e) => {
        if (check.contains(e.target)) return;
        openSheet(upgrade.name, () => {
          const wrap = document.createElement('div');
          wrap.className = 'colony-project-detail-sheet';
          if (upgrade.cost) {
            const row = document.createElement('div');
            row.className = 'colony-project-row';
            row.innerHTML = `<strong>Cost:</strong> ${upgrade.cost}`;
            wrap.appendChild(row);
          }
          if (upgrade.benefit) {
            const row = document.createElement('div');
            row.className = 'colony-project-row';
            row.innerHTML = `<strong>Effect:</strong> ${upgrade.benefit}`;
            wrap.appendChild(row);
          }
          return wrap;
        });
      });

      section.appendChild(card);
    });
    el.appendChild(section);
  });
}


// ============= TRADERS =============

const KEY_TRADERS_ACT = 'rt.traders-act.v1';
const KEY_TRADERS_REP = 'rt.traders-rep.v1';

function getTradersAct() { return Store.get(KEY_TRADERS_ACT) || 1; }
function setTradersAct(act) { Store.set(KEY_TRADERS_ACT, act); }
function getFactionRep(factionName) {
  return (Store.get(KEY_TRADERS_REP) || {})[factionName] || 0;
}
function setFactionRep(factionName, rep) {
  const all = Store.get(KEY_TRADERS_REP) || {};
  all[factionName] = Math.max(0, rep);
  Store.set(KEY_TRADERS_REP, all);
}
const KEY_PROFIT_FACTOR = 'rt.profit-factor.v1';
function getProfitFactor() { return Store.get(KEY_PROFIT_FACTOR) || 0; }
function setProfitFactor(pf) { Store.set(KEY_PROFIT_FACTOR, Math.max(0, pf)); }

function vendorItemAvailable(item, rep, act) {
  if (act < item.act) return false;
  if (item.pf && getProfitFactor() < item.pf) return false;
  if (typeof item.rep === 'number') return rep >= item.rep;
  return true;
}
function vendorItemLockReason(item, rep, act) {
  if (act < item.act) return `Available in Act ${item.act}`;
  if (item.pf && getProfitFactor() < item.pf) return `Requires PF ${item.pf}`;
  if (typeof item.rep === 'number' && rep < item.rep) return `Requires rep ${item.rep}`;
  return null;
}
// Alignment vendor helpers
const KEY_ALIGN_RANKS = 'rt.align-ranks.v1';
const ALIGNMENTS = ['Dogmatic', 'Iconoclast', 'Heretic'];
function getAlignRanks() { return Store.get(KEY_ALIGN_RANKS) || { Dogmatic: 0, Iconoclast: 0, Heretic: 0 }; }
function setAlignRank(alignment, rank) {
  const all = getAlignRanks(); all[alignment] = Math.max(0, rank); Store.set(KEY_ALIGN_RANKS, all);
}
function alignItemAvailable(item, rank, act) {
  if (act < item.act) return false;
  if (item.pf && getProfitFactor() < item.pf) return false;
  return rank >= (item.rank || 0);
}
function curiosityAvailCount(vendor, act) {
  const ranks = getAlignRanks();
  const neutral = vendor.neutral_items.filter(it => act >= it.act).length;
  return neutral + ALIGNMENTS.reduce((sum, a) => {
    const items = vendor[a.toLowerCase() + '_items'] || [];
    return sum + items.filter(it => alignItemAvailable(it, ranks[a], act)).length;
  }, 0);
}

let _traderSearchText = '';

function renderTradersSection() {
  const el = $('traders-content');
  el.innerHTML = '';
  if (!DATA.vendors || !DATA.vendors.length) { el.textContent = 'No vendor data available.'; return; }

  const act = getTradersAct();

  // Act selector
  const actRow = document.createElement('div');
  actRow.className = 'traders-act-row';
  [1, 2, 3, 4].forEach(a => {
    const btn = document.createElement('button');
    btn.className = 'traders-act-btn' + (a === act ? ' active' : '');
    btn.textContent = `Act ${a}`;
    btn.addEventListener('click', () => { setTradersAct(a); renderTradersSection(); });
    actRow.appendChild(btn);
  });
  el.appendChild(actRow);

  // Profit Factor stepper
  const pfRow = document.createElement('div');
  pfRow.className = 'traders-pf-row';
  const pfLabel = document.createElement('span');
  pfLabel.className = 'traders-pf-label';
  pfLabel.textContent = 'Profit Factor';
  const pfDown = document.createElement('button');
  pfDown.className = 'traders-pf-btn'; pfDown.textContent = '−';
  const pfVal = document.createElement('div');
  pfVal.className = 'traders-pf-val'; pfVal.textContent = getProfitFactor();
  const pfUp = document.createElement('button');
  pfUp.className = 'traders-pf-btn'; pfUp.textContent = '+';
  const updatePF = (delta) => {
    setProfitFactor(getProfitFactor() + delta);
    pfVal.textContent = getProfitFactor();
    // Re-render faction list without blowing away the whole section
    renderFactionList(factionListEl, act);
  };
  function addHoldRepeat(btn, delta) {
    let holdTimer = null, repeatInterval = null, wasHeld = false;
    const stop = () => {
      clearTimeout(holdTimer); clearInterval(repeatInterval);
      holdTimer = null; repeatInterval = null;
    };
    // Touch path — preventDefault+stopPropagation blocks iOS callout/selection/synthetic-click
    btn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      e.stopPropagation();
      wasHeld = false;
      holdTimer = setTimeout(() => {
        wasHeld = true;
        updatePF(delta);
        repeatInterval = setInterval(() => updatePF(delta), 100);
      }, 800);
    }, { passive: false });
    btn.addEventListener('touchend', (e) => {
      e.preventDefault();
      if (!wasHeld) updatePF(delta);
      wasHeld = false;
      stop();
    });
    // touchcancel intentionally NOT calling stop() — iOS fires it on long-press selection
    // touch-action:none + preventDefault should prevent selection from starting
    // Mouse path (desktop / preview)
    btn.addEventListener('mousedown', () => {
      wasHeld = false;
      holdTimer = setTimeout(() => {
        wasHeld = true;
        repeatInterval = setInterval(() => updatePF(delta), 100);
      }, 1000);
    });
    btn.addEventListener('click', () => { if (!wasHeld) updatePF(delta); wasHeld = false; });
    btn.addEventListener('mouseup',    stop);
    btn.addEventListener('mouseleave', stop);
  }
  addHoldRepeat(pfDown, -1);
  addHoldRepeat(pfUp,   +1);
  pfRow.append(pfLabel, pfDown, pfVal, pfUp);
  el.appendChild(pfRow);

  // Search bar
  const searchInput = document.createElement('input');
  searchInput.className = 'traders-search';
  searchInput.type = 'search';
  searchInput.placeholder = 'Search items across all factions…';
  searchInput.value = _traderSearchText;
  searchInput.addEventListener('input', (e) => { _traderSearchText = e.target.value; renderTradersSection(); });
  el.appendChild(searchInput);
  if (_traderSearchText) {
    requestAnimationFrame(() => {
      searchInput.focus();
      searchInput.setSelectionRange(searchInput.value.length, searchInput.value.length);
    });
  }

  const factionListEl = document.createElement('div');
  el.appendChild(factionListEl);

  const query = _traderSearchText.trim().toLowerCase();
  if (query.length >= 2) {
    const matches = [];
    DATA.vendors.forEach(faction => {
      if (faction.alignment_vendor) {
        const allItems = [
          ...faction.neutral_items.map(it => ({ ...it, alignment: null })),
          ...ALIGNMENTS.flatMap(a => (faction[a.toLowerCase() + '_items'] || []).map(it => ({ ...it, alignment: a }))),
        ];
        allItems.forEach(item => {
          if (item.name.toLowerCase().includes(query)) matches.push({ item, factionName: faction.name, faction });
        });
      } else {
        faction.items.forEach(item => {
          if (item.name.toLowerCase().includes(query)) matches.push({ item, factionName: faction.name, faction });
        });
      }
    });
    if (!matches.length) {
      const empty = document.createElement('div');
      empty.style.cssText = 'color:var(--ink-dim);padding:12px 0;font-size:15px;';
      empty.textContent = 'No items found.';
      el.appendChild(empty);
    } else {
      matches.forEach(({ item, factionName, faction }) => {
        const rep = getFactionRep(factionName);
        const available = faction.alignment_vendor
          ? alignItemAvailable(item, item.alignment ? getAlignRanks()[item.alignment] : 99, act)
          : vendorItemAvailable(item, rep, act);
        const row = document.createElement('div');
        row.className = 'search-result-item';
        const pfStr = item.pf ? `<span class="search-result-pf">PF ${item.pf}</span>` : '';
        const metaParts = [factionName, item.alignment ? `${item.alignment} rank ${item.rank||0}+` : null, `Act ${item.act}`].filter(Boolean);
        row.innerHTML = `<div class="search-result-name">${item.name}${pfStr}</div>
          <div class="search-result-meta">${metaParts.join(' · ')}${!available ? ' <em style="color:var(--ink-faint)">(locked)</em>' : ''}</div>`;
        row.addEventListener('click', () => {
          _traderSearchText = '';
          if (faction.alignment_vendor) openCuriositySheet(faction, act);
          else openFactionSheet(faction, act, item.name);
        });
        factionListEl.appendChild(row);
      });
    }
    return;
  }

  renderFactionList(factionListEl, act);
}

function renderFactionList(el, act) {
  el.innerHTML = '';
  DATA.vendors.forEach(faction => {
    const card = document.createElement('div');
    if (faction.alignment_vendor) {
      const availCount = curiosityAvailCount(faction, act);
      card.className = 'faction-card curiosity-vendor-card';
      const header = document.createElement('div');
      header.className = 'faction-card-header';
      header.innerHTML = `<div class="faction-name">${faction.name}</div>
        <div class="faction-available-count">${availCount} available</div>`;
      card.appendChild(header);
      const alignRow = document.createElement('div');
      alignRow.className = 'curiosity-align-row';
      ALIGNMENTS.forEach(a => {
        const ranks = getAlignRanks();
        const items = faction[a.toLowerCase() + '_items'] || [];
        const avail = items.filter(it => alignItemAvailable(it, ranks[a], act)).length;
        const pill = document.createElement('div');
        pill.className = 'curiosity-align-pill';
        pill.innerHTML = `<span class="curiosity-align-name">${a}</span><span class="curiosity-align-rank">Rank ${ranks[a]}</span><span class="curiosity-align-avail">${avail} avail</span>`;
        alignRow.appendChild(pill);
      });
      card.appendChild(alignRow);
      card.addEventListener('click', () => openCuriositySheet(faction, act));
    } else {
      const rep = getFactionRep(faction.name);
      const availCount = faction.items.filter(it => vendorItemAvailable(it, rep, act)).length;
      card.className = 'faction-card';
      card.innerHTML = `<div class="faction-card-header">
        <div class="faction-name">${faction.name}</div>
        <div class="faction-rep-badge">Rep ${rep}</div>
        <div class="faction-available-count">${availCount} available</div>
      </div>`;
      card.addEventListener('click', () => openFactionSheet(faction, act, null));
    }
    el.appendChild(card);
  });
}

function openFactionSheet(faction, act, scrollToItem) {
  openSheet(faction.name, () => buildFactionContent(faction, act, scrollToItem));
}

let _curiosityActiveAlignment = 'Dogmatic';
function openCuriositySheet(vendor, act) {
  openSheet(vendor.name, () => buildCuriosityContent(vendor, act));
}

function buildCuriosityContent(vendor, act) {
  const wrap = document.createElement('div');
  let activeAlign = _curiosityActiveAlignment;

  // Alignment tab bar
  const tabBar = document.createElement('div');
  tabBar.className = 'tab-bar';
  const contentEl = document.createElement('div');

  function buildAlignContent() {
    contentEl.innerHTML = '';
    const ranks = getAlignRanks();
    let rank = ranks[activeAlign];
    const items = vendor[activeAlign.toLowerCase() + '_items'] || [];
    const maxRank = items.reduce((m, it) => Math.max(m, it.rank || 0), 0);

    // Rank stepper
    const rankControls = document.createElement('div');
    rankControls.className = 'faction-rep-controls';
    const rankLabel = document.createElement('div');
    rankLabel.className = 'faction-rep-label';
    rankLabel.textContent = `${activeAlign} rank`;
    const rankDown = document.createElement('button');
    rankDown.className = 'faction-rep-btn'; rankDown.textContent = '−';
    const rankVal = document.createElement('div');
    rankVal.className = 'faction-rep-val'; rankVal.textContent = rank;
    const rankUp = document.createElement('button');
    rankUp.className = 'faction-rep-btn'; rankUp.textContent = '+';
    const updateRank = (delta) => {
      rank = Math.max(0, Math.min(maxRank, rank + delta));
      setAlignRank(activeAlign, rank);
      rankVal.textContent = rank;
      buildSections();
      renderTradersSection();
    };
    rankDown.addEventListener('click', () => updateRank(-1));
    rankUp.addEventListener('click',   () => updateRank(+1));
    rankControls.append(rankLabel, rankDown, rankVal, rankUp);
    contentEl.appendChild(rankControls);

    const itemsEl = document.createElement('div');
    contentEl.appendChild(itemsEl);

    function buildSections() {
      itemsEl.innerHTML = '';
      const allItems = [
        ...vendor.neutral_items.map(it => ({ ...it, _neutral: true })),
        ...items,
      ];
      const available = allItems.filter(it => alignItemAvailable(it, rank, act));
      const locked    = allItems.filter(it => !alignItemAvailable(it, rank, act));
      if (available.length) {
        const h = document.createElement('div');
        h.className = 'vendor-section-heading'; h.textContent = 'Available';
        itemsEl.appendChild(h);
        available.forEach(it => itemsEl.appendChild(buildAlignVendorItemEl(it, true, act)));
      }
      if (locked.length) {
        const h = document.createElement('div');
        h.className = 'vendor-section-heading'; h.textContent = 'Locked';
        itemsEl.appendChild(h);
        locked.forEach(it => itemsEl.appendChild(buildAlignVendorItemEl(it, false, act)));
      }
    }
    buildSections();
  }

  ALIGNMENTS.forEach(a => {
    const btn = document.createElement('button');
    btn.className = 'tab-btn' + (a === activeAlign ? ' active' : '');
    btn.textContent = a;
    btn.addEventListener('click', () => {
      activeAlign = a;
      _curiosityActiveAlignment = a;
      tabBar.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.textContent === a));
      buildAlignContent();
    });
    tabBar.appendChild(btn);
  });

  wrap.appendChild(tabBar);
  wrap.appendChild(contentEl);
  buildAlignContent();
  return wrap;
}

function buildAlignVendorItemEl(item, available, act) {
  const el = document.createElement('div');
  el.className = 'vendor-item' + (available ? ' available' : ' locked');
  el.dataset.itemName = item.name;
  const pfHtml = item.pf ? `<span class="vendor-item-pf">PF ${item.pf}</span>` : '';
  const metaParts = [];
  if (!item._neutral && item.rank) metaParts.push(`Rank ${item.rank}+`);
  metaParts.push(`Act ${item.act}`);
  el.innerHTML = `<div class="vendor-item-header"><div class="vendor-item-name">${item.name}</div>${pfHtml}</div>
    <div class="vendor-item-meta">${metaParts.join(' · ')}</div>`;
  if (!available && act < item.act) {
    const lock = document.createElement('div');
    lock.className = 'vendor-item-lock-reason';
    lock.textContent = `Available in Act ${item.act}`;
    el.appendChild(lock);
  }
  el.addEventListener('click', () => {
    const found = lookupGear(item.name.replace(/\s*\(.*?\)\s*$/, '').trim());
    if (found) pushGearDetail(found, item.name);
  });
  return el;
}

function buildFactionContent(faction, act, scrollToItem) {
  const wrap = document.createElement('div');
  let rep = getFactionRep(faction.name);
  const maxRep = faction.items.reduce((m, it) => typeof it.rep === 'number' ? Math.max(m, it.rep) : m, 0);

  // Rep stepper
  const repControls = document.createElement('div');
  repControls.className = 'faction-rep-controls';
  const repLabel = document.createElement('div');
  repLabel.className = 'faction-rep-label';
  repLabel.textContent = 'Reputation level';
  const repDown = document.createElement('button');
  repDown.className = 'faction-rep-btn'; repDown.textContent = '−';
  const repVal = document.createElement('div');
  repVal.className = 'faction-rep-val'; repVal.textContent = rep;
  const repUp = document.createElement('button');
  repUp.className = 'faction-rep-btn'; repUp.textContent = '+';

  const updateRep = (delta) => {
    rep = Math.max(0, Math.min(maxRep, rep + delta));
    setFactionRep(faction.name, rep);
    repVal.textContent = rep;
    buildItems();
    renderTradersSection();
  };
  repDown.addEventListener('click', () => updateRep(-1));
  repUp.addEventListener('click',   () => updateRep(+1));
  repControls.append(repLabel, repDown, repVal, repUp);
  wrap.appendChild(repControls);

  const itemsEl = document.createElement('div');
  wrap.appendChild(itemsEl);

  function buildItems() {
    itemsEl.innerHTML = '';
    const available = faction.items.filter(it => vendorItemAvailable(it, rep, act));
    const locked    = faction.items.filter(it => !vendorItemAvailable(it, rep, act));

    if (available.length) {
      const h = document.createElement('div');
      h.className = 'vendor-section-heading'; h.textContent = 'Available';
      itemsEl.appendChild(h);
      available.forEach(item => itemsEl.appendChild(buildVendorItemEl(item, true, faction.name)));
    }
    if (locked.length) {
      const h = document.createElement('div');
      h.className = 'vendor-section-heading'; h.textContent = 'Locked';
      itemsEl.appendChild(h);
      locked.forEach(item => itemsEl.appendChild(buildVendorItemEl(item, false, faction.name)));
    }

    if (scrollToItem) {
      requestAnimationFrame(() => {
        const all = itemsEl.querySelectorAll('[data-item-name]');
        for (const el of all) {
          if (el.dataset.itemName === scrollToItem) {
            el.scrollIntoView({ block: 'center' });
            el.style.outline = '1px solid var(--gold)';
            setTimeout(() => { el.style.outline = ''; }, 1500);
            break;
          }
        }
      });
    }
  }

  buildItems();
  return wrap;
}

function buildVendorItemEl(item, available, factionName) {
  const el = document.createElement('div');
  el.className = 'vendor-item' + (available ? ' available' : ' locked');
  el.dataset.itemName = item.name;
  const pfHtml = item.pf ? `<span class="vendor-item-pf">PF ${item.pf}</span>` : '';
  el.innerHTML = `<div class="vendor-item-header"><div class="vendor-item-name">${item.name}</div>${pfHtml}</div>
    <div class="vendor-item-meta">Rep ${item.rep} · Act ${item.act}</div>`;
  if (!available) {
    const lock = document.createElement('div');
    lock.className = 'vendor-item-lock-reason';
    lock.textContent = vendorItemLockReason(item, getFactionRep(factionName), getTradersAct()) || '';
    el.appendChild(lock);
  }
  el.addEventListener('click', () => {
    const found = lookupGear(item.name.replace(/\s*\(.*?\)\s*$/, '').trim());
    if (found) pushGearDetail(found, item.name);
  });
  return el;
}


// ============= NOTES =============
const KEY_NOTES = 'rt.notes.v1';

function getNotes() { return Store.get(KEY_NOTES) || []; }
function setNotes(notes) { Store.set(KEY_NOTES, notes); }
function noteTitle(content) {
  const first = (content || '').split('\n').find(l => l.trim());
  if (!first) return 'Untitled';
  return first.replace(/^#+\s*/, '').slice(0, 60) || 'Untitled';
}
function noteChecklistProgress(content) {
  const lines = (content || '').split('\n');
  const total   = lines.filter(l => /^\s*- \[[ xX]\] /.test(l)).length;
  const checked = lines.filter(l => /^\s*- \[[xX]\] /.test(l)).length;
  return total > 0 ? { total, checked } : null;
}
function noteSnippet(content) {
  const lines = (content || '').split('\n');
  let titleSkipped = false;
  const textLines = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    if (!titleSkipped) { titleSkipped = true; continue; } // skip title line
    // Stop at headings, any list item (bullets, checkboxes, numbered), dividers, code fences
    if (/^#{1,6}\s/.test(t) || /^[-*+]\s/.test(t) || /^\d+\.\s/.test(t) || /^-{3,}$/.test(t) || /^`{3}/.test(t)) break;
    textLines.push(t);
    if (textLines.join(' ').length >= 120) break;
  }
  return textLines.join(' ').replace(/[*_`~]/g, '').slice(0, 100);
}
function renderMarkdown(text, onToggleTodo) {
  if (!text) return '';
  const lines = text.split('\n');
  // Escape HTML per-line, tracking line indices for todos
  const escaped = lines.map(l => l.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'));
  let s = escaped.join('\n');
  // Headers
  s = s.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  s = s.replace(/^## (.+)$/gm,  '<h2>$1</h2>');
  s = s.replace(/^# (.+)$/gm,   '<h1>$1</h1>');
  // Bold/italic/code
  s = s.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\*(.+?)\*/g,    '<em>$1</em>');
  s = s.replace(/`(.+?)`/g,      '<code>$1</code>');
  // Horizontal rule
  s = s.replace(/^---$/gm, '<hr>');
  // Todo items (before general list so they match first)
  // We need line numbers — rebuild from per-line processing
  const processedLines = s.split('\n');
  s = processedLines.map((line, i) => {
    // Match on processed line (brackets not escaped)
    if (/^- \[x\] /i.test(line)) {
      const label = line.replace(/^- \[x\] /i, '');
      return `<li class="todo-item todo-done" data-line="${i}"><span class="todo-check">✓</span><span class="todo-label">${label}</span></li>`;
    }
    if (/^- \[ \] /.test(line)) {
      const label = line.replace(/^- \[ \] /, '');
      return `<li class="todo-item" data-line="${i}"><span class="todo-check">☐</span><span class="todo-label">${label}</span></li>`;
    }
    return line;
  }).join('\n');
  // Wrap consecutive todo items in <ul class="todo-list">
  s = s.replace(/((?:<li class="todo-item[^"]*"[^>]*>.*?<\/li>\n?)+)/g, '<ul class="todo-list">$1</ul>');
  // Regular lists: group consecutive - lines
  s = s.replace(/((?:^- .+\n?)+)/gm, (block) => {
    const items = block.split('\n').filter(l => l.startsWith('- ')).map(l => `<li>${l.slice(2)}</li>`).join('');
    return `<ul>${items}</ul>`;
  });
  // Paragraphs
  s = s.replace(/\n{2,}/g, '\n\n');
  const blocks = s.split('\n\n');
  s = blocks.map(b => {
    b = b.trim();
    if (!b) return '';
    if (/^<[hul]|^<hr/.test(b)) return b;
    return '<p>' + b.replace(/\n/g, '<br>') + '</p>';
  }).join('\n');
  return s;
}

const KEY_NOTES_SORT = 'rt.notes-sort.v1';
function getNotesSort() { return Store.get(KEY_NOTES_SORT) || 'updated'; }
function setNotesSort(v) { Store.set(KEY_NOTES_SORT, v); }

// Persistent undo history (localStorage + in-memory write-through)
// ── Undo / Redo history (persistent, per-note) ──
// Storage format: { noteId: { u: [undoStack], r: [redoStack] } }
const KEY_NOTES_HISTORY = 'rt.notes-history.v2';
const MAX_UNDO = 20;
const _historyCache = new Map(); // noteId → { u: [], r: [] }
let _historyCacheLoaded = false;

function _loadHistory() {
  if (_historyCacheLoaded) return;
  _historyCacheLoaded = true;
  const raw = Store.get(KEY_NOTES_HISTORY) || {};
  for (const [id, h] of Object.entries(raw)) _historyCache.set(id, { u: h.u || [], r: h.r || [] });
}
function _saveHistory() {
  const obj = {};
  _historyCache.forEach(({ u, r }, id) => { if (u.length || r.length) obj[id] = { u, r }; });
  Store.set(KEY_NOTES_HISTORY, obj);
}
function _getH(noteId) {
  _loadHistory();
  if (!_historyCache.has(noteId)) _historyCache.set(noteId, { u: [], r: [] });
  return _historyCache.get(noteId);
}
// Call before committing a new edit: snapshot current, clear redo (new branch)
function historyPushEdit(noteId, prevContent) {
  const h = _getH(noteId);
  if (h.u.length && h.u[h.u.length - 1] === prevContent) return; // no dup
  h.u.push(prevContent);
  if (h.u.length > MAX_UNDO) h.u.shift();
  h.r = []; // new edit prunes redo
  _saveHistory();
}
// Returns previous content (or null); caller should push current to redo
function historyUndo(noteId, currentContent) {
  const h = _getH(noteId);
  if (!h.u.length) return null;
  h.r.push(currentContent);
  if (h.r.length > MAX_UNDO) h.r.shift();
  const prev = h.u.pop();
  _saveHistory();
  return prev;
}
// Returns next content (or null); caller should push current to undo
function historyRedo(noteId, currentContent) {
  const h = _getH(noteId);
  if (!h.r.length) return null;
  h.u.push(currentContent);
  if (h.u.length > MAX_UNDO) h.u.shift();
  const next = h.r.pop();
  _saveHistory();
  return next;
}
function historyUndoLen(noteId) { return _getH(noteId).u.length; }
function historyRedoLen(noteId) { return _getH(noteId).r.length; }
// Prune history for deleted notes
function pruneHistory(activeIds) {
  _loadHistory();
  let changed = false;
  _historyCache.forEach((_, id) => { if (!activeIds.has(id)) { _historyCache.delete(id); changed = true; } });
  if (changed) _saveHistory();
}

function sortedNotes(notes, sort) {
  const active   = notes.filter(n => !n.archived);
  const archived = notes.filter(n =>  n.archived);
  const cmp = sort === 'title'   ? (a,b) => noteTitle(a.content).localeCompare(noteTitle(b.content))
            : sort === 'created' ? (a,b) => (b.createdAt||b.updatedAt||0) - (a.createdAt||a.updatedAt||0)
            :                      (a,b) => (b.updatedAt||0) - (a.updatedAt||0);
  return { active: [...active].sort(cmp), archived: [...archived].sort(cmp) };
}

function renderNotesSection() {
  const el = $('notes-content');
  el.innerHTML = '';
  const notes = getNotes();
  const sort  = getNotesSort();

  // Header row
  const headerRow = document.createElement('div');
  headerRow.className = 'notes-header-row';

  // Sort control
  const sortRow = document.createElement('div');
  sortRow.className = 'notes-sort-row';
  ['updated','created','title'].forEach(s => {
    const btn = document.createElement('button');
    btn.className = 'notes-sort-btn' + (sort === s ? ' active' : '');
    btn.textContent = s === 'updated' ? 'Last edited' : s === 'created' ? 'Created' : 'Title';
    btn.addEventListener('click', () => { setNotesSort(s); renderNotesSection(); });
    sortRow.appendChild(btn);
  });

  const addBtn = document.createElement('button');
  addBtn.className = 'notes-add-btn';
  addBtn.textContent = '＋';
  addBtn.title = 'New note';
  addBtn.addEventListener('click', () => openNoteEditor(null));
  headerRow.append(sortRow, addBtn);
  el.appendChild(headerRow);

  const { active, archived } = sortedNotes(notes, sort);

  if (!active.length && !archived.length) {
    const empty = document.createElement('div');
    empty.className = 'notes-empty';
    empty.textContent = 'No notes yet. Tap ＋ to create one.';
    el.appendChild(empty);
    return;
  }

  active.forEach(note => el.appendChild(buildNoteCard(note, false)));

  if (archived.length) {
    const archHeading = document.createElement('div');
    archHeading.className = 'notes-archive-heading';
    archHeading.textContent = `Archived (${archived.length})`;
    el.appendChild(archHeading);
    archived.forEach(note => el.appendChild(buildNoteCard(note, true)));
  }
}

function buildNoteCard(note, isArchived) {
  const outer = document.createElement('div');
  outer.className = 'note-card-outer';

  // Delete background (revealed on left-swipe for active; also archived)
  const deleteBg = document.createElement('div');
  deleteBg.className = 'note-delete-bg';
  deleteBg.textContent = 'Delete';
  outer.appendChild(deleteBg);

  const card = document.createElement('div');
  card.className = 'note-card' + (isArchived ? ' note-archived' : '');

  const title = document.createElement('div');
  title.className = 'note-card-title';
  title.textContent = noteTitle(note.content);
  const snippet = document.createElement('div');
  snippet.className = 'note-card-snippet';
  snippet.textContent = noteSnippet(note.content);
  const date = document.createElement('div');
  date.className = 'note-card-date';
  date.textContent = note.updatedAt ? new Date(note.updatedAt).toLocaleDateString() : '';
  card.append(title, snippet, date);

  const progress = noteChecklistProgress(note.content);
  if (progress) {
    const pct = progress.total ? Math.round((progress.checked / progress.total) * 100) : 0;
    const bar = document.createElement('div');
    bar.className = 'note-progress';
    bar.innerHTML = `<div class="note-progress-bar" style="width:${pct}%"></div>`;
    bar.title = `${progress.checked} of ${progress.total} tasks`;
    const label = document.createElement('span');
    label.className = 'note-progress-label';
    label.textContent = `${progress.checked}/${progress.total}`;
    const wrap = document.createElement('div');
    wrap.className = 'note-progress-wrap';
    wrap.append(bar, label);
    card.appendChild(wrap);
  }

  card.addEventListener('click', () => openNoteEditor(note));
  outer.appendChild(card);

  let startX = 0, startY = 0, dx = 0, intentDecided = false, active = false;
  const DELETE_THRESHOLD = 100;
  const ARCHIVE_THRESHOLD = 80;

  const doDelete = () => {
    card.style.transition = 'transform 0.2s, opacity 0.2s';
    card.style.transform = 'translateX(-100%)';
    card.style.opacity = '0';
    setTimeout(() => {
      const all = getNotes().filter(n => n.id !== note.id);
      setNotes(all);
      pruneHistory(new Set(all.map(n => String(n.id))));
      renderNotesSection();
    }, 200);
  };

  const reset = () => {
    card.style.transition = 'transform 0.2s';
    card.style.transform = '';
    deleteBg.classList.remove('visible');
    setTimeout(() => { card.style.transition = ''; }, 220);
    intentDecided = false; active = false; dx = 0;
  };

  card.addEventListener('touchstart', e => {
    startX = e.touches[0].clientX; startY = e.touches[0].clientY;
    dx = 0; intentDecided = false; active = false;
  }, { passive: true });

  card.addEventListener('touchmove', e => {
    dx = e.touches[0].clientX - startX;
    const dy = e.touches[0].clientY - startY;
    if (!intentDecided) {
      if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
      if (Math.abs(dy) >= Math.abs(dx)) { intentDecided = true; return; } // vertical
      intentDecided = true;
      if (dx > 0 && !isArchived) return; // right swipe on active note - ignore
      active = true;
    }
    if (!active) return;
    card.style.transition = 'none';
    if (!isArchived) {
      // Active note: left swipe → archive only (no delete from active)
      card.style.transform = `translateX(${Math.min(0, dx)}px)`;
      deleteBg.textContent = 'Archive';
      deleteBg.classList.toggle('visible', dx < -20);
    } else {
      // Archived note: left → delete, right → restore
      card.style.transform = `translateX(${dx}px)`;
      deleteBg.textContent = 'Delete';
      deleteBg.classList.toggle('visible', dx < -20);
    }
  }, { passive: true });

  card.addEventListener('touchend', () => {
    if (!active) return;
    if (!isArchived) {
      // Active: swipe left far enough → archive
      if (dx < -ARCHIVE_THRESHOLD) {
        note.archived = true;
        const all = getNotes(); const i = all.findIndex(n => n.id === note.id);
        if (i >= 0) { all[i] = note; setNotes(all); }
        renderNotesSection();
        return;
      }
    } else {
      // Archived: swipe left → delete, swipe right → restore
      if (dx < -ARCHIVE_THRESHOLD) { doDelete(); return; }
      if (dx > ARCHIVE_THRESHOLD) {
        note.archived = false;
        note.updatedAt = Date.now();
        const all = getNotes(); const i = all.findIndex(n => n.id === note.id);
        if (i >= 0) { all[i] = note; setNotes(all); }
        renderNotesSection();
        return;
      }
    }
    reset();
  });

  card.addEventListener('touchcancel', reset);
  deleteBg.addEventListener('click', () => {
    if (isArchived) doDelete();
    else {
      note.archived = true;
      const all = getNotes(); const i = all.findIndex(n => n.id === note.id);
      if (i >= 0) { all[i] = note; setNotes(all); }
      renderNotesSection();
    }
  });

  return outer;
}

function openNoteEditor(note) {
  const isNew = !note;
  if (isNew) {
    note = { id: Date.now() + Math.random(), content: '', updatedAt: Date.now(), createdAt: Date.now() };
    const notes = getNotes();
    notes.unshift(note);
    setNotes(notes);
  }
  // New notes start in edit; existing notes start in preview
  openSheet(isNew ? 'New Note' : noteTitle(note.content), () => buildNoteEditorContent(note, isNew));
}

function buildNoteEditorContent(note, startInEdit = false) {
  const wrap = document.createElement('div');
  wrap.className = 'note-editor-wrap';

  const toolbar = document.createElement('div');
  toolbar.className = 'note-toolbar';

  let previewMode = !startInEdit;
  let drawMode = false;

  const previewFab = document.createElement('button');
  previewFab.className = 'note-preview-fab';

  const drawFab = document.createElement('button');
  drawFab.className = 'note-preview-fab note-draw-fab';
  drawFab.textContent = '✏ Draw';

  const fmtButtons = [
    { label: 'B',  title: 'Bold',        wrap: ['**','**'] },
    { label: 'I',  title: 'Italic',      wrap: ['*','*'] },
    { label: 'H1', title: 'Heading 1',   prefix: '# ' },
    { label: 'H2', title: 'Heading 2',   prefix: '## ' },
    { label: '•',  title: 'List item',   prefix: '- ' },
    { label: '☐',  title: 'Todo item',   prefix: '- [ ] ' },
    { label: '--', title: 'Divider',     insert: '\n---\n' },
  ];

  const textarea = document.createElement('textarea');
  textarea.className = 'note-textarea';
  textarea.value = note.content || '';
  textarea.placeholder = 'Start writing…';
  textarea.style.userSelect = 'text';
  textarea.style.webkitUserSelect = 'text';
  textarea.spellcheck = true;
  textarea.autocorrect = 'on';

  const preview = document.createElement('div');
  preview.className = 'note-preview';

  // ── Doodle canvas ───────────────────────────────────────────────────────────
  const canvas = document.createElement('canvas');
  canvas.className = 'note-doodle-canvas';
  const ctx = canvas.getContext('2d');

  let isDrawing = false, lastX = 0, lastY = 0;
  let drawColor = '#e63946';
  let brushSize = 5;
  let eraserActive = false;
  let doodleChanged = false;

  // Doodle toolbar
  const doodleToolbar = document.createElement('div');
  doodleToolbar.className = 'note-doodle-toolbar hidden';

  const COLORS = ['#1a1a1a','#e63946','#f4a261','#f9c74f','#43aa8b','#4361ee','#9b59b6','#ff6b9d','#8d6748','#ffffff'];
  const colorRow = document.createElement('div');
  colorRow.className = 'doodle-colors';
  COLORS.forEach(color => {
    const sw = document.createElement('button');
    sw.className = 'doodle-swatch' + (color === drawColor ? ' active' : '');
    sw.style.background = color;
    sw.title = color;
    sw.addEventListener('click', () => {
      drawColor = color;
      eraserActive = false;
      doodleToolbar.querySelectorAll('.doodle-swatch').forEach(s => s.classList.remove('active'));
      sw.classList.add('active');
      eraserBtn.classList.remove('active');
    });
    colorRow.appendChild(sw);
  });

  const sizeRow = document.createElement('div');
  sizeRow.className = 'doodle-sizes';
  [{ l: 'S', v: 3 }, { l: 'M', v: 7 }, { l: 'L', v: 16 }].forEach(({ l, v }) => {
    const btn = document.createElement('button');
    btn.className = 'doodle-size-btn' + (v === brushSize ? ' active' : '');
    btn.textContent = l;
    btn.addEventListener('click', () => {
      brushSize = v;
      sizeRow.querySelectorAll('.doodle-size-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
    sizeRow.appendChild(btn);
  });

  const eraserBtn = document.createElement('button');
  eraserBtn.className = 'doodle-tool-btn';
  eraserBtn.textContent = '◻ Eraser';
  eraserBtn.addEventListener('click', () => {
    eraserActive = !eraserActive;
    eraserBtn.classList.toggle('active', eraserActive);
    doodleToolbar.querySelectorAll('.doodle-swatch').forEach(s => s.classList.toggle('active', false));
    if (!eraserActive) {
      const sw = colorRow.querySelector(`.doodle-swatch[style*="${drawColor}"]`);
      if (sw) sw.classList.add('active');
    }
  });

  const clearBtn = document.createElement('button');
  clearBtn.className = 'doodle-tool-btn doodle-clear-btn';
  clearBtn.textContent = '🗑 Clear';
  clearBtn.addEventListener('click', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    note.doodle = null;
    const notes = getNotes();
    const idx = notes.findIndex(n => n.id === note.id);
    if (idx >= 0) { notes[idx] = note; setNotes(notes); }
    doodleChanged = false;
  });

  doodleToolbar.append(colorRow, sizeRow, eraserBtn, clearBtn);

  // Canvas helpers
  const resizeCanvas = () => {
    const area = editorArea;
    const w = area.clientWidth || 300;
    const h = area.clientHeight || 400;
    // Preserve existing pixels
    let saved = null;
    if (canvas.width > 0 && canvas.height > 0) {
      try { saved = ctx.getImageData(0, 0, canvas.width, canvas.height); } catch (_) {}
    }
    canvas.width = w;
    canvas.height = h;
    if (saved) ctx.putImageData(saved, 0, 0);
  };

  const loadDoodle = () => {
    if (!note.doodle) return;
    const img = new Image();
    img.onload = () => ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    img.src = note.doodle;
  };

  const saveDoodle = () => {
    if (!doodleChanged) return;
    const px = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const empty = !Array.from(px).some((v, i) => i % 4 === 3 && v > 0);
    note.doodle = empty ? null : canvas.toDataURL('image/png');
    const notes = getNotes();
    const idx = notes.findIndex(n => n.id === note.id);
    if (idx >= 0) { notes[idx] = note; setNotes(notes); }
    doodleChanged = false;
  };

  const getPos = (e) => {
    const rect = canvas.getBoundingClientRect();
    const src = e.touches ? e.touches[0] : e;
    return {
      x: (src.clientX - rect.left) * (canvas.width / rect.width),
      y: (src.clientY - rect.top)  * (canvas.height / rect.height),
    };
  };

  const startStroke = (e) => {
    e.preventDefault();
    isDrawing = true;
    const { x, y } = getPos(e);
    lastX = x; lastY = y;
    ctx.save();
    if (eraserActive) {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = drawColor;
    }
    ctx.lineWidth = eraserActive ? brushSize * 3 : brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.arc(x, y, (eraserActive ? brushSize * 1.5 : brushSize / 2), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    doodleChanged = true;
  };

  const continueStroke = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    const { x, y } = getPos(e);
    ctx.save();
    if (eraserActive) {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = drawColor;
    }
    ctx.lineWidth = eraserActive ? brushSize * 3 : brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.restore();
    lastX = x; lastY = y;
    doodleChanged = true;
  };

  const endStroke = () => { isDrawing = false; };

  canvas.addEventListener('mousedown',  startStroke);
  canvas.addEventListener('mousemove',  continueStroke);
  canvas.addEventListener('mouseup',    endStroke);
  canvas.addEventListener('mouseleave', endStroke);
  canvas.addEventListener('touchstart', startStroke,    { passive: false });
  canvas.addEventListener('touchmove',  continueStroke, { passive: false });
  canvas.addEventListener('touchend',   endStroke);
  canvas.addEventListener('touchcancel',endStroke);
  // ── End doodle canvas ───────────────────────────────────────────────────────

  // Save indicator
  const saveIndicator = document.createElement('span');
  saveIndicator.className = 'note-save-indicator';
  let fadeTimer = null;
  const flashSaved = () => {
    saveIndicator.classList.add('visible');
    clearTimeout(fadeTimer);
    fadeTimer = setTimeout(() => saveIndicator.classList.remove('visible'), 1200);
  };

  // Undo / Redo buttons
  const undoBtn = document.createElement('button');
  undoBtn.className = 'note-tool-btn note-undo-btn';
  undoBtn.textContent = '↩';
  undoBtn.title = 'Undo';
  const redoBtn = document.createElement('button');
  redoBtn.className = 'note-tool-btn note-undo-btn';
  redoBtn.textContent = '↪';
  redoBtn.title = 'Redo';

  const updateHistoryBtns = () => {
    undoBtn.disabled = historyUndoLen(note.id) === 0;
    redoBtn.disabled = historyRedoLen(note.id) === 0;
  };
  updateHistoryBtns();

  let saveTimer = null;
  const commitSave = () => {
    note.content = textarea.value;
    note.updatedAt = Date.now();
    const notes = getNotes();
    const idx = notes.findIndex(n => n.id === note.id);
    if (idx >= 0) notes[idx] = note; else notes.unshift(note);
    setNotes(notes);
    $('sheet-title').textContent = noteTitle(note.content) || 'New Note';
    flashSaved();
    updateHistoryBtns();
    if (_activeSection === 'notes') renderNotesSection();
  };
  const save = () => { clearTimeout(saveTimer); saveTimer = setTimeout(commitSave, 600); };

  textarea.addEventListener('input', () => {
    historyPushEdit(note.id, note.content);
    updateHistoryBtns();
    save();
  });
  textarea.addEventListener('blur', () => {
    clearTimeout(saveTimer);
    if (textarea.value !== note.content) commitSave();
  });

  textarea.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.shiftKey) return;
    if (textarea.selectionStart !== textarea.selectionEnd) return;
    const val = textarea.value;
    const pos = textarea.selectionStart;
    const lineStart = val.lastIndexOf('\n', pos - 1) + 1;
    const lineEnd   = val.indexOf('\n', pos);
    const fullLine  = val.slice(lineStart, lineEnd === -1 ? undefined : lineEnd);
    const m = fullLine.match(/^(\s*)(- \[[ xX]\] |- |\* )/);
    if (!m) return;
    e.preventDefault();
    const indent    = m[1];
    const rawPrefix = m[2];
    const content   = fullLine.slice(m[0].length).trim();
    const newPrefix = indent + (rawPrefix.match(/- \[/) ? '- [ ] ' : rawPrefix);
    if (content === '') {
      const newVal = val.slice(0, lineStart) + val.slice(lineStart + m[0].length);
      textarea.value = newVal;
      textarea.setSelectionRange(lineStart, lineStart);
    } else {
      const insert = '\n' + newPrefix;
      const newVal = val.slice(0, pos) + insert + val.slice(pos);
      textarea.value = newVal;
      textarea.setSelectionRange(pos + insert.length, pos + insert.length);
    }
    historyPushEdit(note.id, note.content);
    save();
  });

  undoBtn.addEventListener('click', () => {
    clearTimeout(saveTimer);
    const prev = historyUndo(note.id, note.content);
    if (prev == null) return;
    textarea.value = prev;
    commitSave();
    if (previewMode) refreshPreview();
  });
  redoBtn.addEventListener('click', () => {
    clearTimeout(saveTimer);
    const next = historyRedo(note.id, note.content);
    if (next == null) return;
    textarea.value = next;
    commitSave();
    if (previewMode) refreshPreview();
  });

  const refreshPreview = () => {
    preview.innerHTML = renderMarkdown(textarea.value);
    if (note.doodle) {
      const img = document.createElement('img');
      img.className = 'note-doodle-preview';
      img.src = note.doodle;
      preview.appendChild(img);
    }
  };

  const applyMode = () => {
    const sh = document.getElementById('sheet');
    if (previewMode) {
      refreshPreview();
      preview.classList.remove('hidden');
      textarea.classList.add('hidden');
      canvas.classList.add('hidden');
      doodleToolbar.classList.add('hidden');
      toolbar.querySelectorAll('.note-fmt-btn, .note-undo-btn').forEach(b => b.classList.add('hidden'));
      previewFab.textContent = '✎ Edit';
      previewFab.classList.add('active');
      drawFab.classList.remove('active');
      sh.classList.remove('note-editing');
    } else if (drawMode) {
      preview.classList.add('hidden');
      textarea.classList.remove('hidden');
      textarea.style.pointerEvents = 'none';
      canvas.classList.remove('hidden');
      canvas.style.pointerEvents = 'auto';
      doodleToolbar.classList.remove('hidden');
      toolbar.querySelectorAll('.note-fmt-btn, .note-undo-btn').forEach(b => b.classList.add('hidden'));
      previewFab.textContent = '👁 Preview';
      previewFab.classList.remove('active');
      drawFab.textContent = '✎ Text';
      drawFab.classList.add('active');
      sh.classList.add('note-editing');
      requestAnimationFrame(() => {
        resizeCanvas();
        if (note.doodle && canvas.width > 0) loadDoodle();
      });
    } else {
      // Text mode
      preview.classList.add('hidden');
      textarea.classList.remove('hidden');
      textarea.style.pointerEvents = '';
      canvas.classList.remove('hidden');
      canvas.style.pointerEvents = 'none';
      doodleToolbar.classList.add('hidden');
      toolbar.querySelectorAll('.note-fmt-btn, .note-undo-btn').forEach(b => b.classList.remove('hidden'));
      previewFab.textContent = '👁 Preview';
      previewFab.classList.remove('active');
      drawFab.textContent = '✏ Draw';
      drawFab.classList.remove('active');
      sh.classList.add('note-editing');
      requestAnimationFrame(() => textarea.focus());
    }
  };

  fmtButtons.forEach(({ label, title, wrap: w, prefix, insert }) => {
    const btn = document.createElement('button');
    btn.className = 'note-tool-btn note-fmt-btn';
    btn.textContent = label;
    btn.title = title;
    btn.addEventListener('click', () => {
      const start = textarea.selectionStart;
      const end   = textarea.selectionEnd;
      const selected = textarea.value.slice(start, end);
      let newText, newStart, newEnd;
      if (insert) {
        newText = textarea.value.slice(0, start) + insert + textarea.value.slice(end);
        newStart = newEnd = start + insert.length;
      } else if (w) {
        const replacement = w[0] + (selected || 'text') + w[1];
        newText = textarea.value.slice(0, start) + replacement + textarea.value.slice(end);
        newStart = start + w[0].length;
        newEnd = newStart + (selected || 'text').length;
      } else if (prefix) {
        const lineStart = textarea.value.lastIndexOf('\n', start - 1) + 1;
        const lineContent = textarea.value.slice(lineStart, end);
        const already = lineContent.startsWith(prefix);
        const replacement = already ? lineContent.slice(prefix.length) : prefix + lineContent;
        newText = textarea.value.slice(0, lineStart) + replacement + textarea.value.slice(end);
        newStart = newEnd = lineStart + replacement.length;
      }
      textarea.value = newText;
      textarea.focus();
      textarea.setSelectionRange(newStart, newEnd);
      save();
    });
    toolbar.appendChild(btn);
  });

  toolbar.appendChild(undoBtn);
  toolbar.appendChild(redoBtn);
  toolbar.appendChild(saveIndicator);

  preview.addEventListener('click', (e) => {
    const item = e.target.closest('.todo-item');
    if (!item) return;
    const lineIdx = parseInt(item.dataset.line, 10);
    const lines = textarea.value.split('\n');
    const line = lines[lineIdx];
    if (/^- \[x\] /i.test(line)) lines[lineIdx] = line.replace(/^- \[x\] /i, '- [ ] ');
    else if (/^- \[ \] /.test(line)) lines[lineIdx] = line.replace(/^- \[ \] /, '- [x] ');
    textarea.value = lines.join('\n');
    historyPushEdit(note.id, note.content);
    clearTimeout(saveTimer);
    commitSave();
    refreshPreview();
  });

  previewFab.addEventListener('click', () => {
    if (drawMode) { saveDoodle(); drawMode = false; }
    previewMode = !previewMode;
    applyMode();
  });

  drawFab.addEventListener('click', () => {
    if (previewMode) previewMode = false;
    drawMode = !drawMode;
    if (!drawMode) saveDoodle();
    applyMode();
  });

  const editorArea = document.createElement('div');
  editorArea.className = 'note-editor-area';
  editorArea.append(textarea, canvas, preview, previewFab, drawFab);

  wrap.append(toolbar, doodleToolbar, editorArea);

  // Init: load doodle onto canvas after layout settles, then apply mode
  requestAnimationFrame(() => {
    applyMode();
    if (note.doodle && !drawMode && !previewMode) {
      resizeCanvas();
      loadDoodle();
    }
  });
  return wrap;
}


// ============= GEAR BROWSER =============

const GEAR_SLOT_LABELS = {
  armour:  'Armour',
  weapon:  'Weapons',
  helm:    'Helms',
  cloak:   'Cloaks',
  gloves:  'Gloves',
  boots:   'Boots',
  neck:    'Necklaces',
  trinket: 'Trinkets',
  familiar:'Familiars',
};

// Shields are weapons with category: Shield — separate group
const SLOT_ORDER = ['armour','weapon','shield','helm','cloak','gloves','boots','neck','trinket','familiar'];
const SLOT_LABEL = { ...GEAR_SLOT_LABELS, shield: 'Shields' };

function _ng(s) {
  if (!s) return '';
  return s.toLowerCase()
    .replace(/\s*\[.*?\]\s*/g, ' ')
    .replace(/'s\b/g, '')
    .replace(/-/g, ' ')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ').trim()
    .replace(/\bbarreled\b/g, 'barrel')
    .replace(/\bhelmet\b/g, 'helm')
    .replace(/\bvengeance\b/g, 'vengance')
    .replace(/\bvengence\b/g, 'vengance');
}

// ── Build inverted index: normalisedGearName → [{char, buildName, dlc}] ──────
let _gearUsedByIndex = null;

function _buildGearUsedByIndex() {
  if (_gearUsedByIndex) return _gearUsedByIndex;
  _gearUsedByIndex = new Map();

  function addEntry(normKey, entry) {
    if (!normKey) return;
    if (!_gearUsedByIndex.has(normKey)) _gearUsedByIndex.set(normKey, []);
    // Deduplicate by char+buildName
    const list = _gearUsedByIndex.get(normKey);
    if (!list.some(e => e.char === entry.char && e.buildName === entry.buildName)) {
      list.push(entry);
    }
  }

  function indexExtras(extras, char, buildName, dlc) {
    if (!extras || !extras.gear) return;
    extras.gear.forEach(slot => {
      slot.options.split('/').map(o => o.replace(/\s*\(.*?\)\s*$/, '').trim()).filter(Boolean).forEach(opt => {
        const k = _ng(opt);
        // Also add singular/plural variants
        addEntry(k, { char, buildName, dlc });
        if (k.endsWith('s') && k.length > 4) addEntry(k.slice(0, -1), { char, buildName, dlc });
        addEntry(k + 's', { char, buildName, dlc });
      });
    });
  }

  // MC builds
  Object.entries(DATA.extras.mc_extras || {}).forEach(([buildName, extras]) => {
    const build = DATA.mc_builds.find(b => b.name === buildName);
    indexExtras(extras, 'MC', buildName, build && build.dlc);
  });
  // Companion builds
  Object.entries(DATA.extras.comp_extras || {}).forEach(([buildName, extras]) => {
    let char = null;
    Object.entries(DATA.companions).forEach(([cn, variants]) => {
      if (variants.find(v => v.name === buildName)) char = cn;
    });
    const variant = char ? (DATA.companions[char] || []).find(v => v.name === buildName) : null;
    indexExtras(extras, char || '?', buildName, variant && variant.dlc);
  });

  return _gearUsedByIndex;
}

function _getUsedBy(gearItem) {
  const idx = _buildGearUsedByIndex();
  const k = _ng(gearItem.n);
  return idx.get(k) || idx.get(k + 's') || idx.get(k.endsWith('s') ? k.slice(0,-1) : k) || [];
}

// ── State ─────────────────────────────────────────────────────────────────────
const _gb = {
  slot: 'all',
  dlc:  'all',    // 'all' | 'base' | 'Lex Imperialis' | 'Void Shadows'
  char: 'all',    // 'all' | 'MC' | companion name
  act:  'all',    // 'all' | '0' | '1' | '2' | '3' | '4'
  search: '',
};

// ── Main render ───────────────────────────────────────────────────────────────
function renderGearBrowser(container) {
  container.innerHTML = '';

  // ── Filter bar ───────────────────────────────────────────────────────────
  const filterBar = document.createElement('div');
  filterBar.className = 'gb-filter-bar';

  // Search row with clear button
  const searchRow = document.createElement('div');
  searchRow.className = 'gb-search-row';
  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.className = 'gb-search';
  searchInput.placeholder = 'Search gear…';
  searchInput.value = _gb.search;
  searchInput.addEventListener('input', () => { _gb.search = searchInput.value; clearBtn.style.display = _gb.search ? '' : 'none'; renderGearList(listEl); });
  const clearBtn = document.createElement('button');
  clearBtn.className = 'gb-search-clear';
  clearBtn.textContent = '✕';
  clearBtn.title = 'Clear search';
  clearBtn.style.display = _gb.search ? '' : 'none';
  clearBtn.addEventListener('click', () => { _gb.search = ''; searchInput.value = ''; clearBtn.style.display = 'none'; searchInput.focus(); renderGearList(listEl); });
  searchRow.appendChild(searchInput);
  searchRow.appendChild(clearBtn);
  filterBar.appendChild(searchRow);

  // All four filter dropdowns in one row
  const filterRow = document.createElement('div');
  filterRow.className = 'gb-filter-row';

  // Slot select (replaces chip row)
  const slotSel = _makeSelect('Slot', [
    ['all', 'All slots'],
    ...SLOT_ORDER.map(s => [s, SLOT_LABEL[s]]),
  ], _gb.slot, v => { _gb.slot = v; renderGearList(listEl); });
  filterRow.appendChild(slotSel);

  // DLC select
  const dlcSel = _makeSelect('DLC', [
    ['all', 'All DLC'],
    ['base', 'Base game'],
    ['Lex Imperialis', 'Lex Imperialis'],
    ['Void Shadows', 'Void Shadows'],
  ], _gb.dlc, v => { _gb.dlc = v; renderGearList(listEl); });
  filterRow.appendChild(dlcSel);

  // Character select
  const charOptions = [
    ['all', 'Any character'],
    ['MC', 'MC builds'],
    ...COMPANION_ORDER.map(c => [c, c]),
  ];
  const charSel = _makeSelect('Character', charOptions, _gb.char, v => { _gb.char = v; renderGearList(listEl); });
  filterRow.appendChild(charSel);

  // Act select
  const actSel = _makeSelect('Act', [
    ['all', 'Any act'],
    ['0', 'Prologue'],
    ['1', 'Act 1'],
    ['2', 'Act 2'],
    ['3', 'Act 3'],
    ['4', 'Act 4'],
  ], _gb.act, v => { _gb.act = v; renderGearList(listEl); });
  filterRow.appendChild(actSel);

  filterBar.appendChild(filterRow);
  container.appendChild(filterBar);

  // ── Gear list ────────────────────────────────────────────────────────────
  const listEl = document.createElement('div');
  listEl.className = 'gb-list';
  container.appendChild(listEl);
  renderGearList(listEl);
}

// ── Custom branded dropdown (replaces native <select>) ────────────────────────
let _openDropdown = null; // currently open dropdown wrap

function _closeOpenDropdown() {
  if (_openDropdown) {
    _openDropdown.classList.remove('open');
    _openDropdown = null;
  }
}

// Close on outside tap
document.addEventListener('click', (e) => {
  if (_openDropdown && !_openDropdown.contains(e.target)) _closeOpenDropdown();
}, { capture: true });

function _makeSelect(label, options, current, onChange) {
  const wrap = document.createElement('div');
  wrap.className = 'gb-select-wrap';

  const currentLabel = () => (options.find(([v]) => v === current) || options[0])[1];

  const trigger = document.createElement('button');
  trigger.className = 'gb-dd-trigger';
  trigger.setAttribute('aria-label', label);
  trigger.setAttribute('type', 'button');

  const labelEl = document.createElement('span');
  labelEl.className = 'gb-dd-label';
  labelEl.textContent = currentLabel();

  const arrow = document.createElement('span');
  arrow.className = 'gb-dd-arrow';
  arrow.textContent = '▾';

  trigger.appendChild(labelEl);
  trigger.appendChild(arrow);

  const panel = document.createElement('div');
  panel.className = 'gb-dd-panel';

  options.forEach(([val, lbl]) => {
    const row = document.createElement('button');
    row.className = 'gb-dd-option' + (val === current ? ' selected' : '');
    row.setAttribute('type', 'button');
    row.textContent = lbl;
    row.addEventListener('click', (e) => {
      e.stopPropagation();
      current = val;
      labelEl.textContent = lbl;
      panel.querySelectorAll('.gb-dd-option').forEach(r => r.classList.remove('selected'));
      row.classList.add('selected');
      _closeOpenDropdown();
      onChange(val);
    });
    panel.appendChild(row);
  });

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = wrap.classList.contains('open');
    _closeOpenDropdown();
    if (!isOpen) {
      wrap.classList.add('open');
      _openDropdown = wrap;
      // Flip panel up if too close to bottom of viewport
      const rect = trigger.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      panel.classList.toggle('flip-up', spaceBelow < 260);
    }
  });

  wrap.appendChild(trigger);
  wrap.appendChild(panel);
  return wrap;
}

function _matchesFilters(item) {
  // Slot
  if (_gb.slot !== 'all') {
    const isShield = item.cat === 'Shield';
    if (_gb.slot === 'shield') { if (!isShield) return false; }
    else if (_gb.slot === 'weapon') { if (item.s !== 'weapon' || isShield) return false; }
    else { if (item.s !== _gb.slot) return false; }
  }

  // DLC
  if (_gb.dlc !== 'all') {
    if (_gb.dlc === 'base') { if (item.dlc) return false; }
    else { if (item.dlc !== _gb.dlc) return false; }
  }

  // Act
  if (_gb.act !== 'all') {
    if (item.a == null) return true; // unknown act — show in all
    if (String(item.a) !== _gb.act) return false;
  }

  // Character / used-by
  if (_gb.char !== 'all') {
    const usedBy = _getUsedBy(item);
    if (!usedBy.some(e => e.char === _gb.char)) return false;
  }

  // Search
  if (_gb.search) {
    const q = _gb.search.toLowerCase();
    const inName = (item.n || '').toLowerCase().includes(q);
    const inDesc = (item.d || '').toLowerCase().includes(q);
    const inLoc  = (item.l || '').toLowerCase().includes(q);
    if (!inName && !inDesc && !inLoc) return false;
  }

  return true;
}

function renderGearList(listEl) {
  listEl.innerHTML = '';
  _buildGearUsedByIndex(); // ensure index built

  // Filter
  const filtered = (DATA.gear_db || []).filter(_matchesFilters);

  if (!filtered.length) {
    const empty = document.createElement('div');
    empty.className = 'gb-empty';
    empty.textContent = 'No gear matches these filters.';
    listEl.appendChild(empty);
    return;
  }

  // Group
  const groups = new Map(); // groupKey → { label, items }
  filtered.forEach(item => {
    let groupKey;
    if (item.cat === 'Shield') groupKey = 'shield';
    else if (item.s === 'weapon') groupKey = 'weapon';
    else groupKey = item.s || 'other';

    if (!groups.has(groupKey)) {
      groups.set(groupKey, { label: SLOT_LABEL[groupKey] || groupKey, items: [] });
    }
    groups.get(groupKey).items.push(item);
  });

  // Sort groups by SLOT_ORDER
  const orderedGroups = SLOT_ORDER
    .filter(k => groups.has(k))
    .map(k => [k, groups.get(k)]);
  // Append any remaining (shouldn't happen)
  groups.forEach((v, k) => { if (!SLOT_ORDER.includes(k)) orderedGroups.push([k, v]); });

  // Collapse single-group view (no heading needed if slot filter active and only one group)
  const showHeadings = orderedGroups.length > 1;

  orderedGroups.forEach(([, group]) => {
    if (showHeadings) {
      const heading = document.createElement('div');
      heading.className = 'gb-group-heading';
      heading.textContent = group.label + ' (' + group.items.length + ')';
      listEl.appendChild(heading);
    }

    group.items.forEach(item => {
      const row = document.createElement('div');
      row.className = 'gb-item';

      const nameWrap = document.createElement('div');
      nameWrap.className = 'gb-item-name-wrap';

      const name = document.createElement('span');
      name.className = 'gb-item-name';
      name.textContent = item.n;
      nameWrap.appendChild(name);

      if (item.dlc) {
        const badge = makeDlcBadge(item.dlc);
        badge.className = 'dlc-badge dlc-badge-pill';
        nameWrap.appendChild(badge);
      }

      const meta = document.createElement('div');
      meta.className = 'gb-item-meta';

      if (item.a != null) {
        const actBadge = document.createElement('span');
        actBadge.className = 'gb-act-badge';
        actBadge.textContent = actToText(item.a);
        meta.appendChild(actBadge);
      }

      // Used-by chars (abbreviated)
      const usedBy = _getUsedBy(item);
      if (usedBy.length) {
        const chars = [...new Set(usedBy.map(e => e.char))].slice(0, 4);
        const ub = document.createElement('span');
        ub.className = 'gb-used-by';
        ub.textContent = chars.join(' · ');
        meta.appendChild(ub);
      }

      if (item.d) {
        const desc = document.createElement('div');
        desc.className = 'gb-item-desc';
        desc.textContent = item.d.length > 120 ? item.d.slice(0, 117) + '…' : item.d;
        row.appendChild(nameWrap);
        row.appendChild(meta);
        row.appendChild(desc);
      } else {
        row.appendChild(nameWrap);
        row.appendChild(meta);
      }

      const favSub = [item.dlc, item.a != null ? actToText(item.a) : null].filter(Boolean).join(' · ');
      nameWrap.appendChild(_makeFavBtn({
        id: 'fav_gear_' + item.n,
        label: item.n, sub: favSub || '',
        sectionId: 'gear', action: 'gear-detail', itemKey: item.n,
      }));

      row.classList.add('has-detail');
      row.addEventListener('click', () => pushGearDetail(item, item.n));

      listEl.appendChild(row);
    });
  });
}


// ============= REFERENCE LIBRARY SECTIONS =============
// Abilities, Talents, Skills, Character Creation, MC Builds, Retinue

// ── Shared helpers ────────────────────────────────────────────────────────────

function _makeLibSearch(placeholder, onInput) {
  const wrap = document.createElement('div');
  wrap.className = 'lib-search-wrap';
  const inp = document.createElement('input');
  inp.type = 'text';
  inp.className = 'lib-search';
  inp.placeholder = placeholder;
  const clear = document.createElement('button');
  clear.className = 'lib-search-clear';
  clear.textContent = '✕';
  clear.style.display = 'none';
  inp.addEventListener('input', () => {
    clear.style.display = inp.value ? '' : 'none';
    onInput(inp.value);
  });
  clear.addEventListener('click', () => {
    inp.value = ''; clear.style.display = 'none'; inp.focus(); onInput('');
  });
  wrap.appendChild(inp);
  wrap.appendChild(clear);
  return wrap;
}

function _renderDefList(el, entries, query, sectionId) {
  el.innerHTML = '';
  const q = query ? query.toLowerCase() : '';
  let count = 0;
  entries.forEach(([name, desc, dlc]) => {
    if (q && !name.toLowerCase().includes(q) && !(desc || '').toLowerCase().includes(q)) return;
    count++;
    const row = document.createElement('div');
    row.className = 'lib-def-row';
    const header = document.createElement('div');
    header.className = 'lib-def-header';
    const nm = document.createElement('span');
    nm.className = 'lib-def-name';
    nm.textContent = name;
    header.appendChild(nm);
    if (dlc) {
      const badge = makeDlcBadge(dlc);
      if (badge) { badge.className = 'dlc-badge dlc-badge-pill'; header.appendChild(badge); }
    }
    header.appendChild(_makeFavBtn({ id: 'fav_def_' + name, label: name, sub: typeof desc === 'string' ? desc.slice(0,60) : '', sectionId: sectionId || 'abilities', itemKey: name }));
    row.dataset.favKey = name;
    row.appendChild(header);
    if (desc) {
      const d = document.createElement('div');
      d.className = 'lib-def-desc';
      d.textContent = desc;
      row.appendChild(d);
    }
    el.appendChild(row);
  });
  if (!count) {
    const em = document.createElement('div');
    em.className = 'ref-empty';
    em.textContent = 'No results.';
    el.appendChild(em);
  }
}

// ── Abilities ─────────────────────────────────────────────────────────────────

function renderAbilitiesSection(el) {
  el.innerHTML = '';
  const dlcTags = DATA.definitions.dlcTags || {};
  const entries = Object.entries(DATA.definitions.abilities || {})
    .map(([k, v]) => [k, typeof v === 'string' ? v : v.desc || '', dlcTags[k] || null])
    .sort((a, b) => a[0].localeCompare(b[0]));

  const listEl = document.createElement('div');
  listEl.className = 'lib-def-list';

  const search = _makeLibSearch('Search abilities…', q => _renderDefList(listEl, entries, q, 'abilities'));
  el.appendChild(search);
  el.appendChild(listEl);
  _renderDefList(listEl, entries, '', 'abilities');
}

// ── Talents ───────────────────────────────────────────────────────────────────

function renderTalentsSection(el) {
  el.innerHTML = '';
  const dlcTags = DATA.definitions.dlcTags || {};
  const entries = Object.entries(DATA.definitions.talents || {})
    .map(([k, v]) => [k, typeof v === 'string' ? v : v.desc || '', dlcTags[k] || null])
    .sort((a, b) => a[0].localeCompare(b[0]));

  const listEl = document.createElement('div');
  listEl.className = 'lib-def-list';

  const search = _makeLibSearch('Search talents…', q => _renderDefList(listEl, entries, q, 'talents'));
  el.appendChild(search);
  el.appendChild(listEl);
  _renderDefList(listEl, entries, '', 'talents');
}

// ── Skills & Characteristics ──────────────────────────────────────────────────

const _CHAR_STAT_NAMES = new Set([
  'Weapon Skill','Ballistic Skill','Strength','Toughness','Agility',
  'Perception','Willpower','Fellowship','Intelligence',
  'WS','BS','STR','TGH','AGI','AGL','Agi','PER','Per','FEL','Fel','Int','Will','WILL',
  'AP +1','AP +2','Ap +1',
]);

function renderSkillsSection(el) {
  el.innerHTML = '';
  const chars = DATA.definitions.characteristics || {};

  // Separate primary characteristics from skills
  const primaryNames = ['Weapon Skill','Ballistic Skill','Strength','Toughness','Agility','Perception','Willpower','Fellowship','Intelligence'];
  const skillNames = Object.keys(chars).filter(k =>
    !_CHAR_STAT_NAMES.has(k) && !k.startsWith('#') && !k.startsWith('AP ')
  );

  const section = (heading, items) => {
    const h = document.createElement('div');
    h.className = 'lib-section-heading';
    h.textContent = heading;
    el.appendChild(h);
    items.forEach(name => {
      const desc = chars[name];
      if (!desc) return;
      const row = document.createElement('div');
      row.className = 'lib-def-row';
      const nm = document.createElement('div');
      nm.className = 'lib-def-name';
      nm.textContent = name;
      const d = document.createElement('div');
      d.className = 'lib-def-desc';
      d.textContent = typeof desc === 'string' ? desc : '';
      row.dataset.favKey = name;
      row.appendChild(nm);
      row.appendChild(_makeFavBtn({ id: 'fav_skill_' + name, label: name, sub: '', sectionId: 'skills', itemKey: name }));
      row.appendChild(d);
      el.appendChild(row);
    });
  };

  section('Primary Characteristics', primaryNames);
  section('Skills', skillNames.sort());
}

// ── Character Creation: Homeworlds + Origins ──────────────────────────────────

let _ccTab = 'homeworlds'; // 'homeworlds' | 'origins'

function renderCharCreationSection(el) {
  el.innerHTML = '';

  const tabBar = document.createElement('div');
  tabBar.className = 'tab-bar';
  ['homeworlds', 'origins'].forEach(tab => {
    const btn = document.createElement('button');
    btn.className = 'tab-btn' + (_ccTab === tab ? ' active' : '');
    btn.textContent = tab === 'homeworlds' ? 'Homeworlds' : 'Origins';
    btn.addEventListener('click', () => { _ccTab = tab; renderCharCreationSection(el); });
    tabBar.appendChild(btn);
  });
  el.appendChild(tabBar);

  if (_ccTab === 'homeworlds') _renderHomeworlds(el);
  else _renderOrigins(el);
}

function _statBonusRow(bonuses) {
  const wrap = document.createElement('div');
  wrap.className = 'lib-bonus-row';
  const entries = Object.entries(bonuses || {});
  if (!entries.length) return null;
  entries.forEach(([stat, val]) => {
    const chip = document.createElement('span');
    chip.className = 'lib-bonus-chip' + (val < 0 ? ' neg' : '');
    chip.textContent = (val > 0 ? '+' : '') + val + ' ' + stat;
    wrap.appendChild(chip);
  });
  return wrap;
}

function _makeRefCard(name, favOpts) {
  const card = document.createElement('div');
  card.className = 'lib-world-card';
  card.dataset.favKey = name;

  const titleRow = document.createElement('div');
  titleRow.className = 'lib-world-title-row';
  const titleEl = document.createElement('div');
  titleEl.className = 'lib-world-title';
  titleEl.textContent = name;
  titleRow.appendChild(titleEl);
  titleRow.appendChild(_makeFavBtn(favOpts));
  card.appendChild(titleRow);

  return {
    card,
    titleRow,
    addDesc(text) {
      const d = document.createElement('div');
      d.className = 'lib-world-desc';
      d.textContent = text;
      card.appendChild(d);
    },
    addBonuses(bonusObj) {
      const row = _statBonusRow(bonusObj);
      if (row) card.appendChild(row);
    },
    addNote(text) {
      const n = document.createElement('div');
      n.className = 'lib-bonus-note';
      n.textContent = text;
      card.appendChild(n);
    },
    addTalent(talentName, talentDesc) {
      const wrap = document.createElement('div');
      wrap.className = 'lib-talent-row';
      const lbl = document.createElement('span');
      lbl.className = 'lib-talent-label';
      lbl.textContent = 'Talent: ';
      const nm = document.createElement('span');
      nm.className = 'lib-talent-name';
      nm.textContent = talentName;
      wrap.appendChild(lbl);
      wrap.appendChild(nm);
      card.appendChild(wrap);
      if (talentDesc) {
        const td = document.createElement('div');
        td.className = 'lib-world-desc';
        td.style.marginTop = '2px';
        td.textContent = talentDesc;
        card.appendChild(td);
      }
    },
    addExtra(el) {
      card.appendChild(el);
    },
  };
}

function _renderHomeworlds(el) {
  const homeworlds = DATA.definitions.homeworlds || {};
  Object.entries(homeworlds).forEach(([name, hw]) => {
    const ref = _makeRefCard(name, { id: 'fav_hw_' + name, label: name, sub: hw.description ? hw.description.slice(0,60) : '', sectionId: 'charcreate', itemKey: name });
    if (hw.description) ref.addDesc(hw.description);
    ref.addBonuses(hw.bonuses);
    if (hw.bonus_note) ref.addNote(hw.bonus_note);
    if (hw.talent) ref.addTalent(hw.talent, hw.talent_desc);
    el.appendChild(ref.card);
  });
}

function _renderOrigins(el) {
  const origins = DATA.definitions.origins || {};
  const mc = Object.entries(origins).filter(([, o]) => o.mc);
  const comp = Object.entries(origins).filter(([, o]) => !o.mc);

  const renderGroup = (heading, items) => {
    const h = document.createElement('div');
    h.className = 'lib-section-heading';
    h.textContent = heading;
    el.appendChild(h);

    items.forEach(([name, origin]) => {
      const ref = _makeRefCard(name, { id: 'fav_orig_' + name, label: name, sub: origin.description ? origin.description.slice(0,60) : '', sectionId: 'charcreate', itemKey: name });
      if (origin.companion) {
        const ch = document.createElement('span');
        ch.className = 'lib-origin-companion';
        ch.textContent = origin.companion;
        ref.titleRow.insertBefore(ch, ref.titleRow.lastChild);
      }
      if (origin.description) ref.addDesc(origin.description);
      ref.addBonuses(origin.bonuses);
      if (origin.bonus_note) ref.addNote(origin.bonus_note);
      if (origin.archetypes && origin.archetypes.length) {
        const arc = document.createElement('div');
        arc.className = 'lib-origin-archetypes';
        arc.textContent = 'Archetypes: ' + origin.archetypes.join(', ');
        ref.addExtra(arc);
      }
      el.appendChild(ref.card);
    });
  };

  renderGroup('MC Origins', mc);
  renderGroup('Companion Origins', comp);
}

// ── MC Builds ─────────────────────────────────────────────────────────────────

let _mcBuildSearch = '';

function renderMCBuildsSection(el) {
  el.innerHTML = '';

  const listEl = document.createElement('div');

  const search = _makeLibSearch('Search builds…', q => {
    _mcBuildSearch = q;
    _renderMCBuildList(listEl);
  });
  el.appendChild(search);
  el.appendChild(listEl);
  _renderMCBuildList(listEl);
}

function _renderMCBuildList(el) {
  el.innerHTML = '';
  const q = _mcBuildSearch.toLowerCase();

  // Group by theme
  const grouped = new Map();
  (DATA.mc_builds || []).forEach(b => {
    if (q && !b.name.toLowerCase().includes(q) && !(b.origin || '').toLowerCase().includes(q) && !(b.theme || '').toLowerCase().includes(q)) return;
    const theme = b.theme || 'Other';
    if (!grouped.has(theme)) grouped.set(theme, []);
    grouped.get(theme).push(b);
  });

  if (!grouped.size) {
    const em = document.createElement('div');
    em.className = 'ref-empty';
    em.textContent = 'No builds match.';
    el.appendChild(em);
    return;
  }

  grouped.forEach((builds, theme) => {
    const heading = document.createElement('div');
    heading.className = 'gb-group-heading';
    heading.textContent = theme + ' (' + builds.length + ')';
    el.appendChild(heading);

    builds.forEach(b => {
      const card = document.createElement('div');
      card.className = 'lib-build-card';

      const nameRow = document.createElement('div');
      nameRow.className = 'lib-build-name-row';
      const nm = document.createElement('span');
      nm.className = 'lib-build-name';
      nm.textContent = b.name;
      nameRow.appendChild(nm);
      if (b.dlc) {
        const badge = makeDlcBadge(b.dlc);
        if (badge) { badge.className = 'dlc-badge dlc-badge-pill'; nameRow.appendChild(badge); }
      }
      nameRow.appendChild(_makeFavBtn({ id: 'fav_mcbuild_' + b.name, label: b.name, sub: b.theme || '', sectionId: 'mcbuilds', itemKey: b.name }));
      card.dataset.favKey = b.name;
      card.appendChild(nameRow);

      if (b.origin) {
        const orig = document.createElement('div');
        orig.className = 'lib-build-origin';
        orig.textContent = b.origin;
        card.appendChild(orig);
      }

      // Archetype path from archetypes data
      const archs = DATA.archetypes && DATA.archetypes.mc && DATA.archetypes.mc[b.name];
      if (archs && (archs.t1 || archs.t2 || archs.t3)) {
        const path = document.createElement('div');
        path.className = 'lib-build-archetypes';
        const parts = [archs.t1, archs.t2, archs.t3].filter(Boolean);
        path.textContent = parts.join(' → ');
        card.appendChild(path);
      }

      el.appendChild(card);
    });
  });
}

// ── Retinue ───────────────────────────────────────────────────────────────────

const COMPANION_DISPLAY_ORDER = [
  'Abelard','Argenta','Cassia','Heinrix','Idira','Jae',
  'Kibellah','Marazhai','Pasqal','Solomorne','Ulfar','Yrliet',
  'Calligos Winterscale','Incendia Chorda','Uralon',
];

let _retinueSearch = '';

function renderRetinueSection(el) {
  el.innerHTML = '';

  const listEl = document.createElement('div');
  listEl.className = 'lib-retinue-list';

  const search = _makeLibSearch('Search retinue…', q => {
    _retinueSearch = q;
    _renderRetinueList(listEl);
  });
  el.appendChild(search);
  el.appendChild(listEl);
  _renderRetinueList(listEl);
}

function _renderRetinueList(el) {
  el.innerHTML = '';
  const q = _retinueSearch.toLowerCase();
  const bios = DATA.companionBios || {};
  const baseStats = DATA.companionBaseStats || {};

  const order = COMPANION_DISPLAY_ORDER.filter(name => {
    if (!q) return true;
    const bio = bios[name] || {};
    return name.toLowerCase().includes(q)
      || (bio.bio || '').toLowerCase().includes(q)
      || (bio.origin || '').toLowerCase().includes(q);
  });

  if (!order.length) {
    const em = document.createElement('div');
    em.className = 'ref-empty';
    em.textContent = 'No results.';
    el.appendChild(em);
    return;
  }

  order.forEach(name => {
    const bio = bios[name] || {};
    const stats = baseStats[name] || null;

    const card = document.createElement('div');
    card.className = 'lib-retinue-card';

    // Name + DLC badge
    const nameRow = document.createElement('div');
    nameRow.className = 'lib-retinue-name-row';
    const nm = document.createElement('span');
    nm.className = 'lib-retinue-name';
    nm.textContent = name;
    nameRow.appendChild(nm);
    if (bio.dlc) {
      const badge = makeDlcBadge(bio.dlc);
      if (badge) { badge.className = 'dlc-badge dlc-badge-pill'; nameRow.appendChild(badge); }
    }
    nameRow.appendChild(_makeFavBtn({ id: 'fav_retinue_' + name, label: name, sub: bio.origin || '', sectionId: 'retinue', itemKey: name }));
    card.dataset.favKey = name;
    card.appendChild(nameRow);

    // Homeworld / Origin / Join
    const meta = document.createElement('div');
    meta.className = 'lib-retinue-meta';
    const bits = [];
    if (bio.homeworld) bits.push(bio.homeworld);
    if (bio.origin) bits.push(bio.origin);
    if (bio.join) bits.push('Joins: ' + bio.join);
    meta.textContent = bits.join(' · ');
    if (bits.length) card.appendChild(meta);

    // Bio
    if (bio.bio) {
      const bioEl = document.createElement('div');
      bioEl.className = 'lib-retinue-bio';
      bioEl.textContent = bio.bio;
      card.appendChild(bioEl);
    }

    // Base stats mini-table
    if (stats) {
      const statsWrap = document.createElement('div');
      statsWrap.className = 'lib-retinue-stats';
      const STAT_ORDER = ['WS','BS','STR','TGH','AGI','PER','FEL','INT','WILL'];
      STAT_ORDER.forEach(s => {
        if (!stats[s]) return;
        const chip = document.createElement('span');
        chip.className = 'lib-stat-chip';
        const label = document.createElement('span');
        label.className = 'lib-stat-label';
        label.textContent = s;
        const val = document.createElement('span');
        val.className = 'lib-stat-val';
        val.textContent = stats[s];
        chip.appendChild(label);
        chip.appendChild(val);
        statsWrap.appendChild(chip);
      });
      card.appendChild(statsWrap);
    }

    // Wiki link
    if (bio.wiki) {
      const link = document.createElement('a');
      link.className = 'lib-retinue-wiki';
      link.href = bio.wiki;
      link.target = '_blank';
      link.rel = 'noopener';
      link.textContent = 'Wiki →';
      card.appendChild(link);
    }

    el.appendChild(card);
  });
}

// ── Convictions ───────────────────────────────────────────────────────────────

const _CONVICTION_COLOURS = {
  Dogmatic:   { border: 'var(--gold-deep)',    bg: 'rgba(201,164,76,0.06)'  },
  Iconoclast: { border: 'var(--ink-faint)',    bg: 'rgba(232,220,196,0.04)' },
  Heretic:    { border: 'var(--blood)',        bg: 'rgba(139,26,26,0.06)'   },
};

function renderConvictionsSection(el) {
  el.innerHTML = '';
  const data = DATA.definitions.convictions || {};
  const paths = data.paths || {};

  if (data.system) {
    const intro = document.createElement('div');
    intro.className = 'conv-intro';
    intro.textContent = data.system.description;
    el.appendChild(intro);
    if (data.system.note) {
      const note = document.createElement('div');
      note.className = 'conv-intro-note';
      note.textContent = data.system.note;
      el.appendChild(note);
    }
  }

  Object.entries(paths).forEach(([pathName, path]) => {
    const colours = _CONVICTION_COLOURS[pathName] || {};

    const card = document.createElement('div');
    card.className = 'conv-card';
    card.style.borderColor = colours.border || 'var(--rule)';
    card.style.background = colours.bg || 'var(--bg-2)';

    // Header
    const header = document.createElement('div');
    header.className = 'conv-header';
    const icon = document.createElement('span');
    icon.className = 'conv-icon';
    icon.style.color = colours.border || 'var(--gold)';
    icon.textContent = path.icon || '◈';
    const title = document.createElement('span');
    title.className = 'conv-title';
    title.style.color = colours.border || 'var(--gold)';
    title.textContent = pathName;
    header.appendChild(icon);
    header.appendChild(title);
    header.appendChild(_makeFavBtn({ id: 'fav_conv_' + pathName, label: pathName, sub: path.approach ? path.approach.slice(0,60) : '', sectionId: 'convictions', itemKey: pathName }));
    card.dataset.favKey = pathName;
    card.appendChild(header);

    // Approach
    if (path.approach) {
      const appr = document.createElement('div');
      appr.className = 'conv-approach';
      appr.textContent = `"${path.approach}"`;
      card.appendChild(appr);
    }

    // Philosophy
    if (path.philosophy) {
      const phil = document.createElement('div');
      phil.className = 'conv-philosophy';
      phil.textContent = path.philosophy;
      card.appendChild(phil);
    }

    // Companion affinity
    if (path.companion_affinity) {
      const aff = document.createElement('div');
      aff.className = 'conv-affinity-row';
      if (path.companion_affinity.positive && path.companion_affinity.positive.length) {
        const pos = document.createElement('span');
        pos.className = 'conv-affinity-pos';
        pos.textContent = '▲ ' + path.companion_affinity.positive.join(', ');
        aff.appendChild(pos);
      }
      if (path.companion_affinity.negative && path.companion_affinity.negative.length) {
        const neg = document.createElement('span');
        neg.className = 'conv-affinity-neg';
        neg.textContent = '▼ ' + path.companion_affinity.negative.join(', ');
        aff.appendChild(neg);
      }
      card.appendChild(aff);
    }

    // Tiers
    if (path.tiers && path.tiers.length) {
      const tiersHeading = document.createElement('div');
      tiersHeading.className = 'conv-tiers-heading';
      tiersHeading.textContent = 'Conviction Tiers';
      card.appendChild(tiersHeading);

      const tiers = document.createElement('div');
      tiers.className = 'conv-tiers';
      path.tiers.forEach(tier => {
        const row = document.createElement('div');
        row.className = 'conv-tier-row';

        // Rank number + points badge
        const numWrap = document.createElement('div');
        numWrap.className = 'conv-tier-num-wrap';
        const num = document.createElement('span');
        num.className = 'conv-tier-num';
        num.style.borderColor = colours.border || 'var(--gold-deep)';
        num.textContent = tier.rank;
        numWrap.appendChild(num);
        if (tier.points) {
          const pts = document.createElement('span');
          pts.className = 'conv-tier-pts';
          pts.textContent = tier.points + ' pts';
          numWrap.appendChild(pts);
        }
        row.appendChild(numWrap);

        // Name + ability + bonus
        const body = document.createElement('div');
        body.className = 'conv-tier-body';
        const nameEl = document.createElement('div');
        nameEl.className = 'conv-tier-name';
        nameEl.textContent = tier.name;
        body.appendChild(nameEl);
        if (tier.ability) {
          const ab = document.createElement('div');
          ab.className = 'conv-tier-ability';
          ab.textContent = tier.ability;
          body.appendChild(ab);
        }
        if (tier.bonus) {
          const bn = document.createElement('div');
          bn.className = 'conv-tier-bonus';
          bn.textContent = tier.bonus;
          body.appendChild(bn);
        }
        row.appendChild(body);
        tiers.appendChild(row);
      });
      card.appendChild(tiers);
    }

    el.appendChild(card);
  });
}

// ── Romances ──────────────────────────────────────────────────────────────────

function renderRomancesSection(el) {
  el.innerHTML = '';
  const data = DATA.definitions.romances || {};

  const intro = document.createElement('div');
  intro.className = 'conv-intro';
  intro.textContent = 'Romance guides for all romanceable companions. Multiple romances can run simultaneously until Act 4 forces a choice. Argenta and Idira are not romanceable.';
  el.appendChild(intro);

  Object.entries(data).forEach(([name, r]) => {
    const card = document.createElement('div');
    card.className = 'lib-world-card romance-card';

    // Header row
    const titleRow = document.createElement('div');
    titleRow.className = 'lib-world-title-row';
    const title = document.createElement('div');
    title.className = 'lib-world-title';
    title.textContent = name;
    titleRow.appendChild(title);
    titleRow.appendChild(_makeFavBtn({ id: 'fav_romance_' + name, label: name + ' Romance', sub: r.available_to || '', sectionId: 'romances', itemKey: name }));
    card.dataset.favKey = name;
    if (r.dlc) {
      const badge = makeDlcBadge(r.dlc);
      if (badge) { badge.className = 'dlc-badge dlc-badge-pill'; titleRow.appendChild(badge); }
    }
    card.appendChild(titleRow);

    // Meta chips
    const meta = document.createElement('div');
    meta.className = 'romance-meta';
    if (r.available_to) {
      const g = document.createElement('span');
      g.className = 'romance-chip';
      g.textContent = r.available_to;
      meta.appendChild(g);
    }
    if (r.conviction) {
      const c = document.createElement('span');
      c.className = 'romance-chip conviction';
      c.textContent = r.conviction;
      meta.appendChild(c);
    }
    card.appendChild(meta);

    // Summary
    if (r.summary) {
      const sum = document.createElement('div');
      sum.className = 'lib-world-desc';
      sum.textContent = r.summary;
      card.appendChild(sum);
    }

    // Steps
    if (r.steps && r.steps.length) {
      const sh = document.createElement('div');
      sh.className = 'romance-steps-heading';
      sh.textContent = 'Key Steps';
      card.appendChild(sh);
      const steps = document.createElement('div');
      steps.className = 'romance-steps';
      r.steps.forEach(s => {
        const row = document.createElement('div');
        row.className = 'romance-step-row';
        const act = document.createElement('span');
        act.className = 'romance-act-badge';
        act.textContent = s.act != null ? `Act ${s.act}` : '—';
        const txt = document.createElement('span');
        txt.className = 'romance-step-text';
        txt.textContent = s.step;
        row.appendChild(act);
        row.appendChild(txt);
        steps.appendChild(row);
      });
      card.appendChild(steps);
    }

    // Missable
    if (r.missable && r.missable.length) {
      const mh = document.createElement('div');
      mh.className = 'romance-steps-heading missable';
      mh.textContent = '⚠ Missable / Breaks Romance';
      card.appendChild(mh);
      const mlist = document.createElement('ul');
      mlist.className = 'romance-missable-list';
      r.missable.forEach(m => {
        const li = document.createElement('li');
        li.textContent = m;
        mlist.appendChild(li);
      });
      card.appendChild(mlist);
    }

    el.appendChild(card);
  });
}


// ============= REFERENCE =============

let _referenceSubSection = null;
let _referenceSearch = '';

// ── Favourites ────────────────────────────────────────────────────────────────
const KEY_REF_FAVS = 'rt-ref-favourites';
function getRefFavs()    { return Store.get(KEY_REF_FAVS) || []; }
function saveRefFavs(f)  { Store.set(KEY_REF_FAVS, f); }

function toggleRefFav(fav) {
  const favs = getRefFavs();
  const idx  = favs.findIndex(f => f.id === fav.id);
  if (idx >= 0) favs.splice(idx, 1); else favs.push(fav);
  saveRefFavs(favs);
}
function isRefFav(id) { return getRefFavs().some(f => f.id === id); }

// Shared star button — call e.stopPropagation() internally so parent click unaffected
function _makeFavBtn(fav) {
  const btn = document.createElement('button');
  const update = () => {
    const active = isRefFav(fav.id);
    btn.className = 'ref-fav-btn' + (active ? ' active' : '');
    btn.title = active ? 'Remove from Quick Access' : 'Add to Quick Access';
  };
  btn.textContent = '★';
  update();
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleRefFav(fav);
    update();
  });
  return btn;
}

function _navigateToFav(fav) {
  _referenceSubSection = fav.sectionId;
  _referenceSearch = '';
  renderReferenceSection();
  if (fav.action === 'gear-detail' && fav.itemKey) {
    // Gear — push detail sheet directly
    const item = (DATA.gear_db || []).find(g => g.n === fav.itemKey);
    if (item) setTimeout(() => pushGearDetail(item, fav.label), 50);
  } else if (fav.itemKey) {
    // Scroll to and highlight the matching element
    setTimeout(() => {
      const key = fav.itemKey.replace(/['"\\]/g, '\\$&');
      const anchor = document.querySelector(`.reference-sub-content [data-fav-key="${key}"]`);
      if (!anchor) return;
      anchor.scrollIntoView({ behavior: 'smooth', block: 'center' });
      anchor.classList.add('fav-highlight');
      const _clearHighlight = () => {
        anchor.classList.remove('fav-highlight');
        document.removeEventListener('touchstart', _clearHighlight, true);
        document.removeEventListener('click',      _clearHighlight, true);
      };
      setTimeout(() => {
        document.addEventListener('touchstart', _clearHighlight, { capture: true, once: true });
        document.addEventListener('click',      _clearHighlight, { capture: true, once: true });
      }, 400);
    }, 80);
  }
}

function _renderQuickAccess(el) {
  const favs = getRefFavs();
  if (!favs.length) return;

  const wrap = document.createElement('div');
  wrap.className = 'ref-quick-access';

  const heading = document.createElement('div');
  heading.className = 'ref-quick-heading';
  heading.textContent = 'Quick Access';
  wrap.appendChild(heading);

  favs.forEach(fav => {
    const row = document.createElement('div');
    row.className = 'ref-quick-row';
    row.addEventListener('click', () => _navigateToFav(fav));

    const sec = REFERENCE_SECTIONS.find(s => s.id === fav.sectionId);
    const icon = document.createElement('span');
    icon.className = 'ref-quick-icon';
    icon.textContent = sec ? sec.icon : '★';

    const info = document.createElement('div');
    info.className = 'ref-quick-info';
    const lbl = document.createElement('div');
    lbl.className = 'ref-quick-label';
    lbl.textContent = fav.label;
    info.appendChild(lbl);
    if (fav.sub) {
      const sub = document.createElement('div');
      sub.className = 'ref-quick-sub';
      sub.textContent = fav.sub;
      info.appendChild(sub);
    }

    const removeBtn = document.createElement('button');
    removeBtn.className = 'ref-fav-btn active';
    removeBtn.textContent = '★';
    removeBtn.title = 'Remove from Quick Access';
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleRefFav(fav);
      row.remove();
      if (!getRefFavs().length) wrap.remove();
    });

    row.appendChild(icon);
    row.appendChild(info);
    row.appendChild(removeBtn);
    wrap.appendChild(row);
  });

  el.appendChild(wrap);
}

const REFERENCE_SECTIONS = [
  { id: 'gear',        title: 'Gear Browser',            subtitle: 'Browse all gear by slot, DLC, character, or act', icon: '✦' },
  { id: 'retinue',     title: 'Retinue',                 subtitle: 'Companion profiles, bios, base stats & wiki links', icon: '◈' },
  { id: 'mcbuilds',    title: 'MC Builds',               subtitle: 'All playable MC builds grouped by theme',          icon: '★' },
  { id: 'charcreate',  title: 'Character Creation',      subtitle: 'Homeworlds, origins and stat bonuses',             icon: '♦' },
  { id: 'abilities',   title: 'Abilities',               subtitle: 'All ability descriptions, searchable',             icon: '✺' },
  { id: 'talents',     title: 'Talents',                 subtitle: 'All talent descriptions, searchable',              icon: '✸' },
  { id: 'skills',       title: 'Skills & Characteristics', subtitle: 'Reference for all stats and skills',             icon: '≡' },
  { id: 'convictions', title: 'Convictions',              subtitle: 'Dogmatic, Iconoclast & Heretic — tiers & effects', icon: '◉' },
  { id: 'romances',    title: 'Romance Guides',           subtitle: 'Key choices & steps for each romanceable companion', icon: '♡' },
  { id: 'resources',   title: 'Star System Resources',   subtitle: 'Resource deposits by system or type',             icon: '⬡' },
];

function renderReferenceSection() {
  const el = $('reference-content');
  el.innerHTML = '';
  if (_referenceSubSection) {
    // Back button — lives in el; sub-content gets its own container so it can
    // clear itself without clobbering this button
    const backBtn = document.createElement('button');
    backBtn.className = 'reference-back-btn';
    backBtn.innerHTML = '← Reference';
    backBtn.addEventListener('click', () => { _referenceSubSection = null; renderReferenceSection(); });
    el.appendChild(backBtn);

    const subEl = document.createElement('div');
    subEl.className = 'reference-sub-content';
    el.appendChild(subEl);

    if      (_referenceSubSection === 'gear')       renderGearBrowser(subEl);
    else if (_referenceSubSection === 'resources')  renderResourcesContent(subEl);
    else if (_referenceSubSection === 'abilities')  renderAbilitiesSection(subEl);
    else if (_referenceSubSection === 'talents')    renderTalentsSection(subEl);
    else if (_referenceSubSection === 'skills')     renderSkillsSection(subEl);
    else if (_referenceSubSection === 'charcreate') renderCharCreationSection(subEl);
    else if (_referenceSubSection === 'mcbuilds')   renderMCBuildsSection(subEl);
    else if (_referenceSubSection === 'retinue')      renderRetinueSection(subEl);
    else if (_referenceSubSection === 'convictions')  renderConvictionsSection(subEl);
    else if (_referenceSubSection === 'romances')     renderRomancesSection(subEl);
  } else {
    // Search bar (always visible on landing)
    const searchWrap = document.createElement('div');
    searchWrap.className = 'ref-global-search-wrap';
    const searchInp = document.createElement('input');
    searchInp.type = 'text';
    searchInp.className = 'ref-global-search';
    searchInp.placeholder = 'Search all reference…';
    searchInp.value = _referenceSearch;
    const clearBtn = document.createElement('button');
    clearBtn.className = 'lib-search-clear';
    clearBtn.textContent = '✕';
    clearBtn.style.display = _referenceSearch ? '' : 'none';
    const resultsEl = document.createElement('div');

    const doSearch = (q) => {
      _referenceSearch = q;
      clearBtn.style.display = q ? '' : 'none';
      if (q) {
        resultsEl.innerHTML = '';
        _renderGlobalSearchResults(resultsEl, q);
      } else {
        _renderReferenceLandingGrid(resultsEl);
      }
    };

    searchInp.addEventListener('input', () => doSearch(searchInp.value));
    clearBtn.addEventListener('click', () => {
      searchInp.value = ''; searchInp.focus(); doSearch('');
    });
    searchWrap.appendChild(searchInp);
    searchWrap.appendChild(clearBtn);

    _renderQuickAccess(el);
    el.appendChild(searchWrap);
    el.appendChild(resultsEl);

    doSearch(_referenceSearch);
  }
}

function _renderReferenceLandingGrid(el) {
  el.innerHTML = '';
  const grid = document.createElement('div');
  grid.className = 'reference-grid';
  REFERENCE_SECTIONS.forEach(({ id, title, subtitle, icon }) => {
    const card = document.createElement('div');
    card.className = 'reference-card';
    card.innerHTML = `<div class="reference-card-icon">${icon}</div>
      <div class="reference-card-body">
        <div class="reference-card-title">${title}</div>
        <div class="reference-card-sub">${subtitle}</div>
      </div>`;
    card.addEventListener('click', () => { _referenceSubSection = id; renderReferenceSection(); });
    grid.appendChild(card);
  });
  el.appendChild(grid);
}

function _renderGlobalSearchResults(el, rawQ) {
  const q = rawQ.toLowerCase();
  const MAX = 5;

  const match = (...strs) => strs.some(s => s && s.toLowerCase().includes(q));

  // Each group: { sectionId, title, icon, rows: [{label, sub}] }
  const groups = [];

  // Gear
  const gearRows = (DATA.gear_db || []).filter(g => match(g.n, g.d, g.l))
    .map(g => ({ label: g.n, sub: g.l || g.d || '' }));
  if (gearRows.length) groups.push({ sectionId: 'gear', title: 'Gear', icon: '✦', rows: gearRows });

  // Abilities
  const abilityRows = Object.entries(DATA.definitions.abilities || {})
    .filter(([k, v]) => match(k, typeof v === 'string' ? v : v.desc))
    .map(([k, v]) => ({ label: k, sub: typeof v === 'string' ? v : v.desc || '' }));
  if (abilityRows.length) groups.push({ sectionId: 'abilities', title: 'Abilities', icon: '✺', rows: abilityRows });

  // Talents
  const talentRows = Object.entries(DATA.definitions.talents || {})
    .filter(([k, v]) => match(k, typeof v === 'string' ? v : v.desc))
    .map(([k, v]) => ({ label: k, sub: typeof v === 'string' ? v : v.desc || '' }));
  if (talentRows.length) groups.push({ sectionId: 'talents', title: 'Talents', icon: '✸', rows: talentRows });

  // Skills / Characteristics
  const skillRows = Object.entries(DATA.definitions.characteristics || {})
    .filter(([k, v]) => match(k, typeof v === 'string' ? v : ''))
    .map(([k, v]) => ({ label: k, sub: typeof v === 'string' ? v : '' }));
  if (skillRows.length) groups.push({ sectionId: 'skills', title: 'Skills & Characteristics', icon: '≡', rows: skillRows });

  // Homeworlds
  const hwRows = Object.entries(DATA.definitions.homeworlds || {})
    .filter(([k, v]) => match(k, v.description))
    .map(([k, v]) => ({ label: k, sub: v.description || '' }));
  if (hwRows.length) groups.push({ sectionId: 'charcreate', title: 'Homeworlds', icon: '♦', rows: hwRows });

  // Origins
  const origRows = Object.entries(DATA.definitions.origins || {})
    .filter(([k, v]) => match(k, v.description))
    .map(([k, v]) => ({ label: k, sub: v.description || '' }));
  if (origRows.length) groups.push({ sectionId: 'charcreate', title: 'Origins', icon: '♦', rows: origRows });

  // Convictions
  const convPaths = (DATA.definitions.convictions || {}).paths || {};
  const convRows = Object.entries(convPaths)
    .filter(([k, v]) => match(k, v.philosophy, v.approach))
    .map(([k, v]) => ({ label: k, sub: v.approach || '' }));
  if (convRows.length) groups.push({ sectionId: 'convictions', title: 'Convictions', icon: '◉', rows: convRows });

  // Romances
  const romanceRows = Object.entries(DATA.definitions.romances || {})
    .filter(([k, v]) => match(k, v.summary, v.conviction, v.available_to))
    .map(([k, v]) => ({ label: k, sub: v.available_to || '' }));
  if (romanceRows.length) groups.push({ sectionId: 'romances', title: 'Romances', icon: '♡', rows: romanceRows });

  // MC Builds
  const buildRows = (DATA.mc_builds || [])
    .filter(b => match(b.name, b.origin, b.theme))
    .map(b => ({ label: b.name, sub: b.origin || b.theme || '' }));
  if (buildRows.length) groups.push({ sectionId: 'mcbuilds', title: 'MC Builds', icon: '★', rows: buildRows });

  // Retinue
  const bios = DATA.companionBios || {};
  const retinueRows = Object.entries(bios)
    .filter(([name, b]) => match(name, b.bio, b.origin, b.homeworld))
    .map(([name, b]) => ({ label: name, sub: b.origin || '' }));
  if (retinueRows.length) groups.push({ sectionId: 'retinue', title: 'Retinue', icon: '◈', rows: retinueRows });

  // Star Systems
  const sysRows = (DATA.resourceSystems || [])
    .filter(s => match(s.name))
    .map(s => ({ label: s.name, sub: '' }));
  if (sysRows.length) groups.push({ sectionId: 'resources', title: 'Star Systems', icon: '⬡', rows: sysRows });

  if (!groups.length) {
    const none = document.createElement('div');
    none.className = 'gb-empty';
    none.textContent = 'No results across any section.';
    el.appendChild(none);
    return;
  }

  groups.forEach(({ sectionId, title, icon, rows }) => {
    const section = document.createElement('div');
    section.className = 'ref-search-group';

    const heading = document.createElement('div');
    heading.className = 'ref-search-group-heading';
    const iconEl = document.createElement('span');
    iconEl.className = 'ref-search-group-icon';
    iconEl.textContent = icon;
    const titleEl = document.createElement('span');
    titleEl.textContent = title;
    heading.appendChild(iconEl);
    heading.appendChild(titleEl);
    section.appendChild(heading);

    const shown = rows.slice(0, MAX);
    shown.forEach(({ label, sub }) => {
      const row = document.createElement('div');
      row.className = 'ref-search-result-row';
      row.addEventListener('click', () => { _referenceSubSection = sectionId; _referenceSearch = ''; renderReferenceSection(); });
      const lbl = document.createElement('div');
      lbl.className = 'ref-search-result-label';
      lbl.textContent = label;
      row.appendChild(lbl);
      if (sub) {
        const s = document.createElement('div');
        s.className = 'ref-search-result-sub';
        s.textContent = sub.length > 80 ? sub.slice(0, 77) + '…' : sub;
        row.appendChild(s);
      }
      section.appendChild(row);
    });

    if (rows.length > MAX) {
      const more = document.createElement('div');
      more.className = 'ref-search-more';
      more.textContent = `+${rows.length - MAX} more in ${title} →`;
      more.addEventListener('click', () => { _referenceSubSection = sectionId; _referenceSearch = ''; renderReferenceSection(); });
      section.appendChild(more);
    }

    el.appendChild(section);
  });
}

// ── Resources sub-section ─────────────────────────────────────────────────────

const RESOURCE_TYPES = ['people','provisions','chemicals','plasteel','mechanisms','promethium','weapons','xenotech','adamantine','flogiston'];

let _resourceTab      = 'system';
let _selectedSystem   = null;
let _selectedResource = null;

function renderResourcesContent(el) {
  if (!DATA.resourceSystems || !DATA.resourceSystems.length) { el.textContent = 'No resource data.'; return; }

  // Tab bar
  const tabBar = document.createElement('div');
  tabBar.className = 'tab-bar';
  ['system', 'resource'].forEach(tab => {
    const btn = document.createElement('button');
    btn.className = 'tab-btn' + (_resourceTab === tab ? ' active' : '');
    btn.textContent = tab === 'system' ? 'By System' : 'By Resource';
    btn.addEventListener('click', () => { _resourceTab = tab; renderReferenceSection(); });
    tabBar.appendChild(btn);
  });
  el.appendChild(tabBar);

  if (_resourceTab === 'system') renderResourcesBySystem(el);
  else renderResourcesByType(el);
}

function renderResourcesBySystem(el) {
  DATA.resourceSystems.forEach(system => {
    const isSelected = _selectedSystem === system.name;
    const item = document.createElement('div');
    item.className = 'selectable-item' + (isSelected ? ' active' : '');
    const nameEl = document.createElement('div');
    nameEl.className = 'selectable-item-name';
    const nameRow = document.createElement('div');
    nameRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:6px;';
    nameRow.appendChild(nameEl);
    nameEl.textContent = system.name;
    nameRow.appendChild(_makeFavBtn({ id: 'fav_sys_' + system.name, label: system.name, sub: 'Star System', sectionId: 'resources', itemKey: system.name }));
    item.dataset.favKey = system.name;
    const resPreview = system.resources
      ? Object.entries(system.resources)
          .sort(([, a], [, b]) => (Array.isArray(b) ? b[0] : b) - (Array.isArray(a) ? a[0] : a))
          .map(([k, v]) => `${k} ×${Array.isArray(v) ? v[0] : v}`)
          .join(' · ')
      : '';
    if (resPreview || system.extractum || system.event) {
      const sub = document.createElement('div');
      sub.className = 'selectable-item-sub';
      sub.textContent = resPreview;
      item.append(nameRow, sub);
    } else {
      item.appendChild(nameRow);
    }
    item.addEventListener('click', () => {
      _selectedSystem = isSelected ? null : system.name;
      renderReferenceSection();
    });
    el.appendChild(item);

    if (isSelected) {
      const panel = document.createElement('div');
      panel.className = 'resource-detail-panel';
      if (system.resources) {
        Object.entries(system.resources)
          .sort(([, a], [, b]) => (Array.isArray(b) ? b[0] : b) - (Array.isArray(a) ? a[0] : a))
          .forEach(([res, qty]) => {
            const row = document.createElement('div');
            row.className = 'resource-row';
            row.innerHTML = `<div class="resource-name-col">${res[0].toUpperCase() + res.slice(1)}</div>
              <div class="resource-qty">${Array.isArray(qty) ? qty.join('/') : qty}</div>`;
            panel.appendChild(row);
          });
      }
      ['extractum', 'event'].forEach(type => {
        if (system[type]) {
          const row = document.createElement('div');
          row.className = 'resource-row';
          row.innerHTML = `<div class="resource-name-col">${type[0].toUpperCase() + type.slice(1)} Resources</div>
            <span class="resource-quality-badge ${system[type]}">${system[type]}</span>`;
          panel.appendChild(row);
        }
      });
      el.appendChild(panel);
    }
  });
}

function renderResourcesByType(el) {
  RESOURCE_TYPES.forEach(resType => {
    const entries = DATA.resourceSystems
      .filter(s => s.resources && resType in s.resources)
      .map(s => ({ system: s.name, qty: s.resources[resType], qtyNum: Array.isArray(s.resources[resType]) ? s.resources[resType][0] : s.resources[resType] }))
      .sort((a, b) => b.qtyNum - a.qtyNum);

    if (!entries.length) return;
    const isSelected = _selectedResource === resType;
    const label = resType[0].toUpperCase() + resType.slice(1);
    const item = document.createElement('div');
    item.className = 'selectable-item' + (isSelected ? ' active' : '');
    const resNameRow = document.createElement('div');
    resNameRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:6px;';
    const resNameEl = document.createElement('div');
    resNameEl.className = 'selectable-item-name';
    resNameEl.textContent = label;
    resNameRow.appendChild(resNameEl);
    resNameRow.appendChild(_makeFavBtn({ id: 'fav_res_' + resType, label, sub: 'Resource', sectionId: 'resources', itemKey: resType }));
    item.dataset.favKey = resType;
    const resSubEl = document.createElement('div');
    resSubEl.className = 'selectable-item-sub';
    resSubEl.textContent = `${entries.length} system${entries.length !== 1 ? 's' : ''} · best: ${entries[0].system} ×${entries[0].qtyNum}`;
    item.appendChild(resNameRow);
    item.appendChild(resSubEl);
    item.addEventListener('click', () => {
      _selectedResource = isSelected ? null : resType;
      renderReferenceSection();
    });
    el.appendChild(item);

    if (isSelected) {
      const panel = document.createElement('div');
      panel.className = 'resource-detail-panel';
      entries.forEach(({ system, qty }) => {
        const row = document.createElement('div');
        row.className = 'resource-row';
        row.innerHTML = `<div class="resource-name-col">${system}</div>
          <div class="resource-qty">${Array.isArray(qty) ? qty.join('/') : qty}</div>`;
        panel.appendChild(row);
      });
      el.appendChild(panel);
    }
  });
}



// ============= WORKSHOP — Custom Build Manager =============

const KEY_CUSTOM_BUILDS = 'rt-custom-builds';
const KEY_GIST_PAT      = 'rt-gist-pat';

const WS_BASIC_ARCHETYPES    = ['Warrior','Officer','Operative','Soldier','Bladedancer'];
const WS_ADVANCED_ARCHETYPES = ['Assassin','Vanguard','Bounty Hunter','Master Tactician','Grand Strategist','Arch-Militant','Executioner','Overseer','Exemplar'];
const WS_ALL_ARCHETYPES      = [...WS_BASIC_ARCHETYPES, ...WS_ADVANCED_ARCHETYPES];

// ── Storage helpers ───────────────────────────────────────────────────────────
function getCustomBuilds()       { return Store.get(KEY_CUSTOM_BUILDS) || []; }
function saveCustomBuilds(b)     { Store.set(KEY_CUSTOM_BUILDS, b); }
function getGistPat()            { return Store.get(KEY_GIST_PAT) || ''; }
function saveGistPat(p)          { p ? Store.set(KEY_GIST_PAT, p) : Store.remove(KEY_GIST_PAT); }
function _genId()                { return 'cb_' + Date.now().toString(36) + Math.random().toString(36).slice(2,7); }

// ── Merge custom builds into DATA (call at init) ──────────────────────────────
function mergeCustomBuildsIntoData() {
  getCustomBuilds().forEach(b => {
    const entry = { _id: b._id, _custom: true, name: b.name, levels: b.levels || {} };
    if (b.dlc) entry.dlc = b.dlc;
    if (b._character === 'MC') {
      if (DATA.mc_builds.find(x => x._id === b._id)) return;
      entry.theme  = b.theme  || 'Custom';
      entry.origin = b.origin || '';
      DATA.mc_builds.push(entry);
      if (b.archetypes) DATA.archetypes.mc[b.name] = b.archetypes;
      if (b.extras)     DATA.extras.mc_extras[b.name] = b.extras;
    } else {
      const char = b._character;
      if (!DATA.companions[char]) DATA.companions[char] = [];
      if (DATA.companions[char].find(x => x._id === b._id)) return;
      DATA.companions[char].push(entry);
      if (b.archetypes) DATA.archetypes.comp[b.name] = b.archetypes;
      if (b.extras)     DATA.extras.comp_extras[b.name] = b.extras;
    }
  });
}

// ── Workshop state ────────────────────────────────────────────────────────────
// Steps: 'manager' | 'char-select' | 'setup' | 'levels' | 'import-preview'
let _wsStep         = 'manager';
let _wsDraft        = null;
let _wsImportData   = null;
let _wsImportSource = null;
let _wsExpandedLvl  = null;
let _wsStatusMsg    = null; // {text, ok} for feedback banners

// ── Main render ───────────────────────────────────────────────────────────────
function renderWorkshopSection() {
  const el = $('workshop-content');
  el.innerHTML = '';

  if (_wsStatusMsg) {
    const banner = document.createElement('div');
    banner.className = 'ws-banner ' + (_wsStatusMsg.ok ? 'ok' : 'err');
    banner.textContent = _wsStatusMsg.text;
    el.appendChild(banner);
    _wsStatusMsg = null;
  }

  if      (_wsStep === 'manager')        _renderManager(el);
  else if (_wsStep === 'char-select')    _renderCharSelect(el);
  else if (_wsStep === 'setup')          _renderSetup(el);
  else if (_wsStep === 'levels')         _renderLevels(el);
  else if (_wsStep === 'import-preview') _renderImportPreview(el);
}

// ── Manager screen ─────────────────────────────────────────────────────────────
function _renderManager(el) {
  _checkUrlSources(); // background sync

  // Action buttons
  const actions = document.createElement('div');
  actions.className = 'ws-actions';

  const mkBtn = (label, cls, onClick) => {
    const b = document.createElement('button');
    b.className = 'ws-action-btn' + (cls ? ' ' + cls : '');
    b.textContent = label;
    b.addEventListener('click', onClick);
    return b;
  };

  actions.appendChild(mkBtn('+ Build', 'primary', () => {
    _wsDraft = null; _wsStep = 'char-select'; renderWorkshopSection();
  }));
  actions.appendChild(mkBtn('+ From File', '', _importFromFile));
  actions.appendChild(mkBtn('+ From URL',  '', _promptImportUrl));
  actions.appendChild(mkBtn('+ From Gist', '', _promptImportGist));
  el.appendChild(actions);

  // Build list
  const builds = getCustomBuilds();
  if (!builds.length) {
    const empty = document.createElement('div');
    empty.className = 'ws-empty';
    empty.textContent = 'No custom builds yet. Create one or import from a file, URL, or Gist.';
    el.appendChild(empty);
  } else {
    const list = document.createElement('div');
    list.className = 'ws-build-list';

    builds.forEach(b => {
      const row = document.createElement('div');
      row.className = 'ws-build-row';

      // Info
      const info = document.createElement('div');
      info.className = 'ws-build-info';
      const nm = document.createElement('div');
      nm.className = 'ws-build-name';
      nm.textContent = b.name || 'Untitled';
      const meta = document.createElement('div');
      meta.className = 'ws-build-meta';
      const parts = [b._character === 'MC' ? 'MC' : b._character];
      if (b.theme) parts.push(b.theme);
      const src = b._source;
      if (src) parts.push(src.type === 'url' ? '↗ URL' : src.type === 'gist' ? '⬡ Gist' : '↑ File');
      meta.textContent = parts.join(' · ');
      info.appendChild(nm);
      info.appendChild(meta);

      if (b._updateAvailable) {
        const upd = document.createElement('div');
        upd.className = 'ws-update-badge';
        upd.textContent = '⚠ Update available';
        info.appendChild(upd);
      }
      row.appendChild(info);

      // Buttons
      const btns = document.createElement('div');
      btns.className = 'ws-build-btns';

      if (b._updateAvailable) {
        const u = document.createElement('button');
        u.className = 'ws-btn update';
        u.textContent = 'Update';
        u.addEventListener('click', () => _applyUrlUpdate(b._id));
        btns.appendChild(u);
      }

      const editBtn = document.createElement('button');
      editBtn.className = 'ws-btn';
      editBtn.textContent = 'Edit';
      editBtn.addEventListener('click', () => {
        _wsDraft = structuredClone(b);
        _wsExpandedLvl = null;
        _wsStep = 'setup';
        renderWorkshopSection();
      });
      btns.appendChild(editBtn);

      const exportBtn = document.createElement('button');
      exportBtn.className = 'ws-btn';
      exportBtn.textContent = 'Export';
      exportBtn.addEventListener('click', () => _exportBuild(b));
      btns.appendChild(exportBtn);

      const gistBtn = document.createElement('button');
      gistBtn.className = 'ws-btn';
      gistBtn.textContent = 'Gist';
      gistBtn.addEventListener('click', () => _pushToGist(b));
      btns.appendChild(gistBtn);

      const delBtn = document.createElement('button');
      delBtn.className = 'ws-btn danger';
      delBtn.textContent = 'Delete';
      delBtn.addEventListener('click', () => {
        if (!confirm(`Delete "${b.name}"?`)) return;
        _deleteBuild(b._id, b._character);
        renderWorkshopSection();
      });
      btns.appendChild(delBtn);

      row.appendChild(btns);
      list.appendChild(row);
    });
    el.appendChild(list);
  }

  // Gist PAT section
  const gistSec = document.createElement('div');
  gistSec.className = 'ws-gist-section';
  const gistH = document.createElement('div');
  gistH.className = 'ws-section-heading';
  gistH.textContent = 'GitHub Gist — Personal Access Token';
  const gistNote = document.createElement('div');
  gistNote.className = 'ws-gist-note';
  gistNote.innerHTML = 'Optional. Generate at <strong>github.com → Settings → Developer Settings → Tokens</strong> with <strong>gist</strong> scope. Stored locally, never sent anywhere except GitHub.';
  const patRow = document.createElement('div');
  patRow.className = 'ws-pat-row';
  const patInp = document.createElement('input');
  patInp.type = 'password';
  patInp.className = 'ws-pat-input';
  patInp.placeholder = 'ghp_…';
  patInp.value = getGistPat();
  patInp.autocomplete = 'off';
  const patSave = document.createElement('button');
  patSave.className = 'ws-btn';
  patSave.textContent = 'Save';
  patSave.addEventListener('click', () => {
    saveGistPat(patInp.value.trim());
    patSave.textContent = '✓ Saved';
    setTimeout(() => { patSave.textContent = 'Save'; }, 1500);
  });
  const patClear = document.createElement('button');
  patClear.className = 'ws-btn danger';
  patClear.textContent = 'Clear';
  patClear.addEventListener('click', () => { saveGistPat(''); patInp.value = ''; });
  patRow.appendChild(patInp);
  patRow.appendChild(patSave);
  patRow.appendChild(patClear);
  gistSec.appendChild(gistH);
  gistSec.appendChild(gistNote);
  gistSec.appendChild(patRow);
  el.appendChild(gistSec);
}

// ── Character select ──────────────────────────────────────────────────────────
function _renderCharSelect(el) {
  _wsBackBtn(el, 'manager', 'Workshop');

  const heading = document.createElement('div');
  heading.className = 'ws-step-heading';
  heading.textContent = 'Who is this build for?';
  el.appendChild(heading);

  const grid = document.createElement('div');
  grid.className = 'ws-char-grid';

  const mkChar = (label, char) => {
    const btn = document.createElement('div');
    btn.className = 'ws-char-btn';
    btn.textContent = label;
    btn.addEventListener('click', () => {
      _wsDraft = {
        _id: _genId(), _custom: true, _character: char,
        _modified: Date.now(),
        name: '', theme: char === 'MC' ? '' : char,
        origin: '', _homeworld: '', _origin: '',
        archetypes: {}, levels: {}, extras: { skills: '', gear: [] },
      };
      _wsStep = 'setup';
      renderWorkshopSection();
    });
    return btn;
  };

  grid.appendChild(mkChar('Player Character (MC)', 'MC'));
  COMPANION_ORDER.forEach(c => grid.appendChild(mkChar(c, c)));
  el.appendChild(grid);
}

// ── Build setup ───────────────────────────────────────────────────────────────
function _renderSetup(el) {
  _wsBackBtn(el, _wsDraft._character ? 'manager' : 'char-select', 'Workshop');

  const heading = document.createElement('div');
  heading.className = 'ws-step-heading';
  heading.textContent = _wsDraft._character === 'MC'
    ? 'MC Build — Setup' : `${_wsDraft._character} — Setup`;
  el.appendChild(heading);

  const form = document.createElement('div');
  form.className = 'ws-form';

  form.appendChild(_wsInput('Build name *', 'text', _wsDraft.name || '', v => { _wsDraft.name = v; }));

  if (_wsDraft._character === 'MC') {
    form.appendChild(_wsInput('Theme (e.g. Noble, Crimelord)', 'text', _wsDraft.theme || '', v => { _wsDraft.theme = v; }));

    const hwKeys = ['', ...Object.keys(DATA.definitions.homeworlds || {})];
    form.appendChild(_wsInput('Homeworld', 'select', _wsDraft._homeworld || '', v => {
      _wsDraft._homeworld = v;
      // Auto-build origin description
      _updateOriginText();
    }, { options: hwKeys }));

    const mcOrigins = ['', ...Object.entries(DATA.definitions.origins || {})
      .filter(([,o]) => o.mc).map(([k]) => k)];
    form.appendChild(_wsInput('Origin', 'select', _wsDraft._origin || '', v => {
      _wsDraft._origin = v;
      _updateOriginText();
    }, { options: mcOrigins }));

    // Auto-generated or manual origin description
    const origField = _wsInput('Origin description (auto-filled or override)', 'text', _wsDraft.origin || '', v => { _wsDraft.origin = v; });
    origField.dataset.wsOriginField = '1';
    form.appendChild(origField);
  }

  // Archetypes
  form.appendChild(_wsInput('Archetype — Tier 1', 'select', _wsDraft.archetypes?.t1 || '', v => {
    if (!_wsDraft.archetypes) _wsDraft.archetypes = {};
    _wsDraft.archetypes.t1 = v;
  }, { options: ['', ...WS_BASIC_ARCHETYPES] }));
  form.appendChild(_wsInput('Archetype — Tier 2', 'select', _wsDraft.archetypes?.t2 || '', v => {
    if (!_wsDraft.archetypes) _wsDraft.archetypes = {};
    _wsDraft.archetypes.t2 = v;
  }, { options: ['', ...WS_ADVANCED_ARCHETYPES] }));
  form.appendChild(_wsInput('Archetype — Tier 3 (optional)', 'select', _wsDraft.archetypes?.t3 || '', v => {
    if (!_wsDraft.archetypes) _wsDraft.archetypes = {};
    _wsDraft.archetypes.t3 = v || undefined;
  }, { options: ['', ...WS_ADVANCED_ARCHETYPES] }));

  form.appendChild(_wsInput('Recommended skills (comma-separated)', 'text',
    _wsDraft.extras?.skills || '', v => {
      if (!_wsDraft.extras) _wsDraft.extras = { gear: [] };
      _wsDraft.extras.skills = v;
  }));

  el.appendChild(form);

  const nextBtn = document.createElement('button');
  nextBtn.className = 'ws-next-btn';
  nextBtn.textContent = 'Continue → Level Picks';
  nextBtn.addEventListener('click', () => {
    if (!(_wsDraft.name || '').trim()) { alert('Build name required.'); return; }
    _wsExpandedLvl = null;
    _wsStep = 'levels';
    renderWorkshopSection();
  });
  el.appendChild(nextBtn);

  function _updateOriginText() {
    const hw = _wsDraft._homeworld || '';
    const orig = _wsDraft._origin || '';
    if (hw || orig) {
      const text = [hw, orig].filter(Boolean).join(' - ');
      _wsDraft.origin = text;
      const inp = form.querySelector('[data-ws-origin-field] input');
      if (inp) inp.value = text;
    }
  }
}

// ── Level pick editor ─────────────────────────────────────────────────────────
function _renderLevels(el) {
  _wsBackBtn(el, 'setup', _wsDraft.name || 'Setup');

  const heading = document.createElement('div');
  heading.className = 'ws-step-heading';
  heading.textContent = `${_wsDraft.name} — Level Picks`;
  el.appendChild(heading);

  const hint = document.createElement('div');
  hint.className = 'ws-hint';
  hint.textContent = 'Tap any level to set picks. Autocomplete shows all known talents, abilities, and characteristics.';
  el.appendChild(hint);

  // Datalist for autocomplete
  const dl = _buildPickDatalist();
  el.appendChild(dl);

  // Level list
  const list = document.createElement('div');
  list.className = 'ws-level-list';

  for (let n = 1; n <= MAX_LVL; n++) {
    const entry = (_wsDraft.levels && _wsDraft.levels[n]) || {};
    const isExpanded = _wsExpandedLvl === n;

    const row = document.createElement('div');
    row.className = 'ws-level-row' + (n === level ? ' is-current' : '') + (isExpanded ? ' expanded' : '');

    const lbl = document.createElement('div');
    lbl.className = 'ws-level-num';
    lbl.textContent = n;
    row.appendChild(lbl);

    if (isExpanded) {
      const inputs = document.createElement('div');
      inputs.className = 'ws-level-inputs';
      inputs.appendChild(_wsInput('Main pick', 'pick', entry.m || '', v => {
        if (!_wsDraft.levels) _wsDraft.levels = {};
        if (!_wsDraft.levels[n]) _wsDraft.levels[n] = {};
        _wsDraft.levels[n].m = v;
        if (!v && !_wsDraft.levels[n].e) delete _wsDraft.levels[n];
      }));
      inputs.appendChild(_wsInput('Extra pick', 'pick', entry.e || '', v => {
        if (!_wsDraft.levels) _wsDraft.levels = {};
        if (!_wsDraft.levels[n]) _wsDraft.levels[n] = {};
        _wsDraft.levels[n].e = v || undefined;
        if (!v && !_wsDraft.levels[n].m) delete _wsDraft.levels[n];
      }));
      row.appendChild(inputs);

      const done = document.createElement('button');
      done.className = 'ws-level-done';
      done.textContent = '✓';
      done.addEventListener('click', () => { _wsExpandedLvl = null; renderWorkshopSection(); });
      row.appendChild(done);
    } else {
      const summary = document.createElement('div');
      summary.className = 'ws-level-summary';
      const parts = [];
      if (entry.m) parts.push(entry.m);
      if (entry.e) parts.push('+ ' + entry.e);
      summary.textContent = parts.length ? parts.join(' · ') : '—';
      summary.style.color = parts.length ? '' : 'var(--ink-faint)';
      row.appendChild(summary);
      row.addEventListener('click', () => { _wsExpandedLvl = n; renderWorkshopSection(); });
    }

    list.appendChild(row);
  }
  el.appendChild(list);

  const saveBtn = document.createElement('button');
  saveBtn.className = 'ws-next-btn';
  saveBtn.textContent = '✓ Save Build';
  saveBtn.addEventListener('click', () => {
    _wsDraft._modified = Date.now();
    _saveDraft();
    _wsStep = 'manager';
    _wsExpandedLvl = null;
    _wsStatusMsg = { text: `"${_wsDraft.name}" saved.`, ok: true };
    renderWorkshopSection();
  });
  el.appendChild(saveBtn);
}

function _buildPickDatalist() {
  const dl = document.createElement('datalist');
  dl.id = 'ws-pick-dl';
  const seen = new Set();
  const add = v => { if (v && !seen.has(v)) { seen.add(v); const o = document.createElement('option'); o.value = v; dl.appendChild(o); } };

  ['Weapon Skill','Ballistic Skill','Strength','Toughness','Agility','Perception','Willpower','Fellowship','Intelligence',
   'AP +1','AP +2','Medicae','Commerce','Lore Imperium','Lore Xenos','Lore Warp','Persuasion','Coercion','Logic',
   'Tech-Use','Awareness','Athletics','Demolition','Carouse','Tracking','Navigate Warp'].forEach(add);
  Object.keys(DATA.definitions.talents  || {}).forEach(add);
  Object.keys(DATA.definitions.abilities || {}).forEach(add);
  return dl;
}

// ── Import preview ────────────────────────────────────────────────────────────
function _renderImportPreview(el) {
  _wsBackBtn(el, 'manager', 'Workshop');

  const heading = document.createElement('div');
  heading.className = 'ws-step-heading';
  heading.textContent = 'Import Preview';
  el.appendChild(heading);

  const b = _wsImportData;
  if (!b) { el.appendChild(Object.assign(document.createElement('div'), { className: 'ws-empty', textContent: 'No data.' })); return; }

  const preview = document.createElement('div');
  preview.className = 'ws-preview';

  [
    ['Name',        b.name || '—'],
    ['Character',   b._character || 'MC'],
    ['Theme',       b.theme || '—'],
    ['Origin',      b.origin || '—'],
    ['Archetypes',  [b.archetypes?.t1, b.archetypes?.t2, b.archetypes?.t3].filter(Boolean).join(' → ') || '—'],
    ['Levels set',  Object.keys(b.levels || {}).length],
    ['Source',      _wsImportSource?.url || _wsImportSource?.type || 'file'],
  ].forEach(([label, val]) => {
    const row = document.createElement('div');
    row.className = 'ws-preview-row';
    const l = document.createElement('span');
    l.className = 'ws-preview-label';
    l.textContent = label;
    const v = document.createElement('span');
    v.className = 'ws-preview-val';
    v.textContent = val;
    row.appendChild(l);
    row.appendChild(v);
    preview.appendChild(row);
  });
  el.appendChild(preview);

  const confirmBtn = document.createElement('button');
  confirmBtn.className = 'ws-next-btn';
  confirmBtn.textContent = '✓ Import Build';
  confirmBtn.addEventListener('click', () => {
    const build = { ..._wsImportData, _id: _genId(), _custom: true, _modified: Date.now() };
    if (_wsImportSource) build._source = _wsImportSource;
    const builds = getCustomBuilds();
    builds.push(build);
    saveCustomBuilds(builds);
    mergeCustomBuildsIntoData();
    _wsImportData = null; _wsImportSource = null;
    _wsStatusMsg = { text: `"${build.name}" imported.`, ok: true };
    _wsStep = 'manager';
    renderWorkshopSection();
  });
  el.appendChild(confirmBtn);
}

// ── Import: file ──────────────────────────────────────────────────────────────
function _importFromFile() {
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = '.json';
  inp.addEventListener('change', async () => {
    const file = inp.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const build = _parseImportText(text);
      if (!build) { alert('Could not parse build file. Must be a valid JSON build export.'); return; }
      _wsImportData   = build;
      _wsImportSource = { type: 'file', filename: file.name };
      _wsStep = 'import-preview';
      renderWorkshopSection();
    } catch (e) { alert('Error reading file: ' + e.message); }
  });
  inp.click();
}

// ── Import: URL ───────────────────────────────────────────────────────────────
function _promptImportUrl() {
  const url = prompt('Enter build URL (must return JSON):', '');
  if (!url) return;
  _fetchAndPreviewUrl(url.trim());
}

async function _fetchAndPreviewUrl(url) {
  try {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const text  = await resp.text();
    const etag  = resp.headers.get('ETag') || '';
    const build = _parseImportText(text);
    if (!build) { alert('Could not parse build at URL.'); return; }
    _wsImportData   = build;
    _wsImportSource = { type: 'url', url, etag, lastChecked: Date.now() };
    _wsStep = 'import-preview';
    renderWorkshopSection();
  } catch (e) { alert('Error fetching URL: ' + e.message); }
}

// ── Import: Gist ──────────────────────────────────────────────────────────────
function _promptImportGist() {
  const input = prompt('Enter Gist URL or ID:', '');
  if (!input) return;
  // Extract gist ID from URL or use raw
  const id = input.match(/gist\.github\.com\/(?:[^/]+\/)?([a-f0-9]+)/i)?.[1]
           || input.match(/gists\/([a-f0-9]+)/i)?.[1]
           || input.trim();
  _fetchGistAndPreview(id);
}

async function _fetchGistAndPreview(gistId) {
  try {
    const headers = {};
    const pat = getGistPat();
    if (pat) headers['Authorization'] = `token ${pat}`;
    const resp = await fetch(`https://api.github.com/gists/${gistId}`, { headers });
    if (!resp.ok) throw new Error(`GitHub API: HTTP ${resp.status}`);
    const data  = await resp.json();
    const files = Object.values(data.files || {});
    if (!files.length) throw new Error('Gist has no files');
    const content = files[0].content || await (await fetch(files[0].raw_url)).text();
    const build = _parseImportText(content);
    if (!build) { alert('Could not parse gist content as a build.'); return; }
    _wsImportData   = build;
    _wsImportSource = { type: 'gist', gistId: data.id, url: data.html_url, lastChecked: Date.now() };
    _wsStep = 'import-preview';
    renderWorkshopSection();
  } catch (e) { alert('Error loading gist: ' + e.message); }
}

// ── Export: file ──────────────────────────────────────────────────────────────
function _exportBuild(b) {
  const clean = Object.fromEntries(Object.entries(b).filter(([k]) => !k.startsWith('_')));
  clean._character = b._character; // keep this one
  const blob = new Blob([JSON.stringify(clean, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = (b.name || 'build').replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

// ── Export: Gist ──────────────────────────────────────────────────────────────
async function _pushToGist(b) {
  const pat = getGistPat();
  const clean = Object.fromEntries(Object.entries(b).filter(([k]) => !k.startsWith('_update')));
  clean._character = b._character;
  const body = {
    description: `RT Build: ${b.name}`,
    public: false,
    files: { 'rt-build.json': { content: JSON.stringify(clean, null, 2) } },
  };
  const headers = { 'Content-Type': 'application/json' };
  if (pat) headers['Authorization'] = `token ${pat}`;

  try {
    const existingGistId = b._source?.gistId;
    const url    = existingGistId && pat
      ? `https://api.github.com/gists/${existingGistId}`
      : 'https://api.github.com/gists';
    const method = existingGistId && pat ? 'PATCH' : 'POST';

    const resp = await fetch(url, { method, headers, body: JSON.stringify(body) });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}${pat ? '' : ' (no PAT — anonymous gists cannot be updated)'}`);
    const data = await resp.json();

    // Persist gist info on build
    const builds = getCustomBuilds();
    const idx = builds.findIndex(x => x._id === b._id);
    if (idx >= 0) {
      builds[idx]._source = { type: 'gist', gistId: data.id, url: data.html_url };
      saveCustomBuilds(builds);
    }

    _wsStatusMsg = { text: `Saved to Gist: ${data.html_url}`, ok: true };
    renderWorkshopSection();
    // Also copy URL to clipboard if possible
    if (navigator.clipboard) navigator.clipboard.writeText(data.html_url).catch(() => {});
  } catch (e) {
    alert('Gist error: ' + e.message);
  }
}

// ── Save / delete ─────────────────────────────────────────────────────────────
function _saveDraft() {
  const builds = getCustomBuilds();
  const idx = builds.findIndex(x => x._id === _wsDraft._id);
  if (idx >= 0) builds[idx] = _wsDraft;
  else           builds.push(_wsDraft);
  saveCustomBuilds(builds);
  mergeCustomBuildsIntoData();
}

function _deleteBuild(id, character) {
  saveCustomBuilds(getCustomBuilds().filter(x => !(x._id === id && x._character === character)));
  if (character === 'MC') {
    DATA.mc_builds = DATA.mc_builds.filter(x => x._id !== id);
  } else {
    const arr = DATA.companions[character];
    if (arr) DATA.companions[character] = arr.filter(x => x._id !== id);
  }
}

// ── URL sync (background) ─────────────────────────────────────────────────────
async function _checkUrlSources() {
  const builds  = getCustomBuilds();
  let changed   = false;
  for (const b of builds) {
    const src = b._source;
    if (!src || src.type !== 'url' || !src.url) continue;
    // Throttle: only check if >30 minutes since last check
    if (src.lastChecked && Date.now() - src.lastChecked < 30 * 60 * 1000) continue;
    try {
      const headers = src.etag ? { 'If-None-Match': src.etag } : {};
      const resp = await fetch(src.url, { headers });
      src.lastChecked = Date.now();
      if (resp.status === 304) { changed = true; continue; }
      if (!resp.ok) continue;
      const text     = await resp.text();
      const newEtag  = resp.headers.get('ETag') || '';
      const newBuild = _parseImportText(text);
      if (!newBuild) continue;
      // Compare content (ignore metadata)
      const snapshot = b => JSON.stringify({ name: b.name, levels: b.levels, archetypes: b.archetypes });
      if (snapshot(newBuild) !== snapshot(b)) {
        b._updateAvailable = true;
        b._pendingUpdate   = newBuild;
      }
      src.etag = newEtag;
      changed  = true;
    } catch (_) {}
  }
  if (changed) {
    saveCustomBuilds(builds);
    renderWorkshopSection();
  }
}

function _applyUrlUpdate(id) {
  const builds = getCustomBuilds();
  const b = builds.find(x => x._id === id);
  if (!b || !b._pendingUpdate) return;
  Object.assign(b, b._pendingUpdate);
  delete b._updateAvailable;
  delete b._pendingUpdate;
  b._modified = Date.now();
  saveCustomBuilds(builds);
  mergeCustomBuildsIntoData();
  _wsStatusMsg = { text: 'Build updated from source.', ok: true };
  renderWorkshopSection();
}

// ── Parse helper ──────────────────────────────────────────────────────────────
function _parseImportText(text) {
  try {
    const j = JSON.parse(text.trim());
    return _normaliseBuild(j);
  } catch (_) { return null; }
}

function _normaliseBuild(obj) {
  if (!obj || typeof obj !== 'object') return null;
  return {
    name:       obj.name       || 'Imported Build',
    _character: obj._character || 'MC',
    theme:      obj.theme      || '',
    origin:     obj.origin     || '',
    archetypes: obj.archetypes || {},
    levels:     obj.levels     || {},
    extras:     obj.extras     || { skills: '', gear: [] },
    dlc:        obj.dlc        || null,
  };
}

// ── UI helpers ────────────────────────────────────────────────────────────────
function _wsBackBtn(el, step, label) {
  const btn = document.createElement('button');
  btn.className = 'reference-back-btn';
  btn.textContent = '← ' + (label || 'Workshop');
  btn.addEventListener('click', () => { _wsStep = step; renderWorkshopSection(); });
  el.appendChild(btn);
}

function _wsInput(label, type, value, onChange, opts) {
  // opts: { options: [[val,lbl],...] } for select
  //       { listId: 'id' } for pick (datalist)
  //       nothing extra for text/password
  const wrap = document.createElement('div');
  wrap.className = type === 'pick' ? 'ws-pick-wrap' : 'ws-field';
  const lbl = document.createElement('label');
  lbl.className = 'ws-field-label';
  lbl.textContent = label;
  wrap.appendChild(lbl);

  if (type === 'select') {
    const sel = document.createElement('select');
    sel.className = 'ws-field-select';
    (opts && opts.options || []).forEach(opt => {
      const o = document.createElement('option');
      o.value = opt;
      o.textContent = opt || '— choose —';
      if (opt === value) o.selected = true;
      sel.appendChild(o);
    });
    sel.addEventListener('change', () => onChange(sel.value));
    wrap.appendChild(sel);
  } else {
    const inp = document.createElement('input');
    inp.type = type === 'pick' ? 'text' : type;
    inp.className = 'ws-field-input';
    inp.value = value;
    if (type === 'pick') {
      inp.setAttribute('list', 'ws-pick-dl');
      inp.addEventListener('change', () => onChange(inp.value));
      inp.addEventListener('blur',   () => onChange(inp.value));
    } else {
      inp.addEventListener('input', () => onChange(inp.value));
    }
    wrap.appendChild(inp);
  }

  return wrap;
}


// Merge any custom builds from localStorage into DATA before first render
mergeCustomBuildsIntoData();

// ── Google Analytics ──
const KEY_CLIENT_UUID = 'rt.client-uuid.v1';
function getOrCreateUUID() {
  let id = Store.get(KEY_CLIENT_UUID);
  if (!id) {
    id = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
          const r = Math.random() * 16 | 0;
          return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });
    Store.set(KEY_CLIENT_UUID, id);
  }
  return id;
}
if (typeof gtag === 'function') {
  const uuid = getOrCreateUUID();
  const rtName = getMCName() || 'Unknown';
  gtag('config', 'G-H6KCF4RNBT', {
    user_id: uuid,
    custom_map: { dimension1: 'rogue_trader_name' },
  });
  gtag('event', 'app_open', {
    rogue_trader_name: rtName,
    user_id: uuid,
    app_version: 'v17',
  });
}

// Dismiss splash after app is ready
requestAnimationFrame(() => {
  const splash = document.getElementById('splash');
  if (splash) {
    splash.classList.add('fade-out');
    splash.addEventListener('transitionend', () => splash.remove(), { once: true });
  }
});

// ── Keyboard / visualViewport handling (iOS: keyboard pushes content) ──
if (window.visualViewport) {
  const sheet = document.getElementById('sheet');
  const resetSheet = () => {
    sheet.style.bottom = '';
    sheet.style.height = '';
    sheet.style.maxHeight = '';
    sheet.classList.remove('keyboard-open');
  };
  const onVVChange = () => {
    if (!sheet.classList.contains('open')) return;
    const vv = window.visualViewport;
    // keyboard height = gap between bottom of visual viewport and bottom of layout viewport
    const keyboardH = Math.max(0, window.innerHeight - (vv.offsetTop + vv.height));
    if (keyboardH > 50) {
      // Pin sheet exactly above keyboard; set explicit height = visible area
      // CSS flex handles internal distribution — no JS component measurement needed
      sheet.style.bottom    = keyboardH + 'px';
      sheet.style.height    = vv.height + 'px';
      sheet.style.maxHeight = vv.height + 'px';
      sheet.classList.add('keyboard-open');
    } else {
      resetSheet();
    }
  };
  window.visualViewport.addEventListener('resize', onVVChange);
  window.visualViewport.addEventListener('scroll', onVVChange);
  document.getElementById('sheet-overlay').addEventListener('click', resetSheet);
  document.getElementById('sheet-close').addEventListener('click', resetSheet);
}

// ── SW update badge ──
(() => {
  // Inject badge + toast into DOM
  const badge = document.createElement('button');
  badge.id = 'update-badge';
  badge.className = 'update-badge hidden';
  badge.setAttribute('aria-label', 'App update available');
  badge.innerHTML = '⟳';

  const toast = document.createElement('div');
  toast.id = 'update-toast';
  toast.className = 'update-toast hidden';
  toast.innerHTML = `
    <div class="update-toast-text">Update ready - close and reload to apply changes.</div>
    <button class="update-toast-reload" id="update-reload-btn">Reload Now</button>`;

  document.body.append(badge, toast);

  const showBadge = () => badge.classList.remove('hidden');

  badge.addEventListener('click', () => toast.classList.toggle('hidden'));
  document.getElementById('update-reload-btn').addEventListener('click', () => window.location.reload());

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').then(reg => {
        // Already a new SW waiting (e.g. page refreshed after update downloaded)
        if (reg.waiting && navigator.serviceWorker.controller) showBadge();

        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              showBadge();
            }
          });
        });
      }).catch(err => console.warn('SW registration failed:', err));
    });
  }
})();

// ── About ──
(() => {
  const el = document.getElementById('app-about');
  if (!el || typeof APP_VERSION === 'undefined') return;

  const aboutBtn = document.createElement('button');
  aboutBtn.className = 'app-about-link';
  aboutBtn.style.background = 'none';
  aboutBtn.style.border = 'none';
  aboutBtn.style.cursor = 'pointer';
  aboutBtn.style.padding = '0';
  aboutBtn.textContent = 'About';

  aboutBtn.addEventListener('click', () => {
    openSheet('About', () => {
      const wrap = document.createElement('div');
      wrap.className = 'about-sheet';

      wrap.innerHTML = `
        <p class="about-blurb">
          This app was built by <strong>Lilmuckers</strong> as a hobby project to make building
          a min-maxed character easier when playing Warhammer 40,000: Rogue Trader.
          True to form, it ended up being a bigger distraction from actually playing the
          game than the game itself.
        </p>
        <p class="about-blurb">
          If you find it useful, great. If you're also still on your first playthrough two
          years in because you kept respeccing - you're not alone.
        </p>
        <p class="about-blurb">
          Built using a combination of <strong>Claude Code</strong>, <strong>ChatGPT Codex</strong>,
          and <strong>Qwen3.5</strong>, running as an autonomous delivery swarm on <strong>OpenClaw</strong>.
        </p>

        <div class="about-section-heading">Build Data</div>
        <p class="about-blurb">
          Build progression data comes from
          <a class="about-link" href="https://docs.google.com/spreadsheets/d/1rskX4sYcNm6Wqt4rtm8EQqRR4__yrEuxCEzjwoKlHOY/" target="_blank" rel="noopener">
            Revan619's community build sheet
          </a>
          - an exhaustive community resource covering optimal builds for every character
          in the game. All credit for the build theory goes there.
        </p>

        <div class="about-section-heading">Item &amp; Ability Data</div>
        <p class="about-blurb">
          Item descriptions, locations, and ability details were sourced from:
        </p>
        <ul class="about-sources">
          <li><a class="about-link" href="https://roguetrader.wh40k.wiki/" target="_blank" rel="noopener">roguetrader.wh40k.wiki</a></li>
          <li><a class="about-link" href="https://roguetrader.wiki.fextralife.com/" target="_blank" rel="noopener">Fextralife Rogue Trader Wiki</a></li>
          <li><a class="about-link" href="https://gamefaqs.gamespot.com/ps5/369358-warhammer-40000-rogue-trader/faqs/82192" target="_blank" rel="noopener">GameFAQs Rogue Trader Guide</a> (companion base stats)</li>
        </ul>

        <div class="about-section-heading">Source Code</div>
        <p class="about-blurb">
          <a class="about-link" href="https://github.com/lilmuckers/rogue-trader-level-tool" target="_blank" rel="noopener">
            github.com/lilmuckers/rogue-trader-level-tool
          </a>
        </p>

        <p class="about-disclaimer">
          Warhammer 40,000: Rogue Trader is developed by Owlcat Games.
          Warhammer 40,000 is a trademark of Games Workshop Ltd.
          This app is a fan-made tool with no affiliation to either.
        </p>
      `;

      // Check for updates button (only when SW supported)
      if ('serviceWorker' in navigator) {
        const updateSection = document.createElement('div');
        updateSection.className = 'about-section-heading';
        updateSection.textContent = 'App Version';
        wrap.appendChild(updateSection);

        const updateRow = document.createElement('div');
        updateRow.className = 'about-update-row';

        const versionLabel = document.createElement('span');
        versionLabel.className = 'about-update-version';
        versionLabel.textContent = `v${APP_VERSION}`;

        const checkBtn = document.createElement('button');
        checkBtn.className = 'about-update-btn';
        checkBtn.textContent = 'Check for updates';

        const statusEl = document.createElement('span');
        statusEl.className = 'about-update-status';

        checkBtn.addEventListener('click', async () => {
          checkBtn.disabled = true;
          statusEl.textContent = 'Checking…';
          statusEl.className = 'about-update-status checking';
          try {
            const reg = await navigator.serviceWorker.getRegistration();
            if (!reg) {
              statusEl.textContent = 'No service worker registered.';
              statusEl.className = 'about-update-status error';
              checkBtn.disabled = false;
              return;
            }
            await reg.update();
            if (reg.waiting && navigator.serviceWorker.controller) {
              statusEl.textContent = 'Update ready — reload to apply.';
              statusEl.className = 'about-update-status ready';
              document.getElementById('update-badge')?.classList.remove('hidden');
            } else {
              statusEl.textContent = 'Already up to date.';
              statusEl.className = 'about-update-status ok';
            }
          } catch (e) {
            statusEl.textContent = 'Check failed.';
            statusEl.className = 'about-update-status error';
          }
          checkBtn.disabled = false;
        });

        // Long-press → nuke all caches + unregister SW + hard reload
        let _forceTimer = null;
        const _startForce = () => {
          _forceTimer = setTimeout(async () => {
            _forceTimer = null;
            checkBtn.disabled = true;
            statusEl.textContent = 'Clearing all caches…';
            statusEl.className = 'about-update-status checking';
            try {
              const keys = await caches.keys();
              await Promise.all(keys.map(k => caches.delete(k)));
              const reg = await navigator.serviceWorker.getRegistration();
              if (reg) await reg.unregister();
            } catch (e) { /* best effort */ }
            location.reload(true);
          }, 800);
        };
        const _cancelForce = () => { if (_forceTimer) { clearTimeout(_forceTimer); _forceTimer = null; } };
        checkBtn.addEventListener('touchstart', _startForce, { passive: true });
        checkBtn.addEventListener('touchend',   _cancelForce);
        checkBtn.addEventListener('touchmove',  _cancelForce);
        checkBtn.addEventListener('mousedown',  _startForce);
        checkBtn.addEventListener('mouseup',    _cancelForce);
        checkBtn.addEventListener('mouseleave', _cancelForce);

        updateRow.appendChild(versionLabel);
        updateRow.appendChild(checkBtn);
        updateRow.appendChild(statusEl);
        wrap.appendChild(updateRow);
      }

      return wrap;
    });
  });

  el.innerHTML = `<span class="app-about-version">v${APP_VERSION}</span><span class="app-about-sep">·</span>`;
  el.appendChild(aboutBtn);
})();
