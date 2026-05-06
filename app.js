document.addEventListener('contextmenu', e => e.preventDefault());

const DEFAULT_JOIN_LEVELS ={"Abelard": 1, "Idira": 1, "Argenta": 3, "Pasqal": 6, "Cassia": 10, "Heinrix": 12, "Yrliet": 14, "Jae": 16, "Ulfar": 22, "Marazhai": 31, "Kibellah": 33, "Solomorne": 37, "Incendia Chorda": 40, "Calligos Winterscale": 40, "Uralon": 40};

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
// Visual states (when atLevel is provided):
//   .pick-chosen     — bold gold: chosen at this exact level
//   .pick-unavailable — strikethrough grey: taken at a different level
//   .pick-unchosen   — italic grey: sibling was chosen here, this one wasn't
//   (none)           — plain: undecided
// When atLevel is null (description popup) taken options are just greyed.
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
        span.className = 'pick-chosen';       // chosen here → bold
      } else if (choiceLevel !== null) {
        span.className = 'pick-unavailable';  // taken elsewhere → strikethrough
      } else if (decidedAtLevel) {
        span.className = 'pick-unchosen';     // sibling chosen here → italic
      }
      // else undecided → no class
    } else {
      if (choiceLevel !== null) span.className = 'pick-unavailable'; // popup: just grey taken
    }
    span.textContent = part;
    containerEl.appendChild(span);
  });
}
// Builds the choice-selection UI for a slash pick into `targetEl`.
// atLevel is recorded when the player marks a choice.
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
      const src = document.createElement('div');
      src.className = 'desc-source';
      src.textContent = 'Skill / Stat allocation';
      opt.appendChild(src);
    } else {
      const hits = lookupPick(part);
      if (hits.length > 0) {
        const hit = hits[0];
        const src = document.createElement('div');
        src.className = 'desc-source';
        src.textContent = hit.kind;
        opt.appendChild(src);
        const txt = document.createElement('div');
        txt.className = 'desc-text';
        txt.textContent = hit.desc;
        opt.appendChild(txt);
      }
    }

    const btn = document.createElement('button');
    if (isTaken) {
      btn.className = 'choice-btn choice-btn-untake';
      btn.textContent = '✓ Taken — unmark';
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

// ── Roster migration: build KEY_ROSTER from legacy KEY_CONFIG on first run ──
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
      buildName: mc.name, arch: detectArchetype(mc.origin) || '—',
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
  return wrap;
}

// ============= DRAG REORDER =============
function attachDragReorder(handle, wrap, section) {
  let startY = 0, startIdx = 0, ghost = null;

  handle.addEventListener('touchstart', (e) => {
    e.preventDefault();
    e.stopPropagation();
    startY = e.touches[0].clientY;
    wrap.classList.add('dragging');
    ghost = wrap.cloneNode(true);
    ghost.classList.add('drag-ghost');
    ghost.style.top = wrap.getBoundingClientRect().top + 'px';
    document.body.appendChild(ghost);

    const siblings = Array.from(wrap.parentElement.querySelectorAll(`.roster-card-wrap[data-section="${section}"]`));
    startIdx = siblings.indexOf(wrap);
  }, { passive: false });

  handle.addEventListener('touchmove', (e) => {
    if (!ghost) return;
    e.preventDefault();
    const dy = e.touches[0].clientY - startY;
    ghost.style.transform = `translateY(${dy}px)`;

    // Find which slot we're over
    const rEl = $('roster');
    const siblings = Array.from(rEl.querySelectorAll(`.roster-card-wrap[data-section="${section}"]`));
    const fingerY = e.touches[0].clientY;
    let targetIdx = startIdx;
    siblings.forEach((el, i) => {
      if (el === wrap) return;
      const rect = el.getBoundingClientRect();
      if (fingerY > rect.top + rect.height / 2) targetIdx = i;
    });

    // Visually reorder
    siblings.forEach(el => el.classList.remove('drag-over'));
    if (siblings[targetIdx] && siblings[targetIdx] !== wrap) {
      siblings[targetIdx].classList.add('drag-over');
    }
  }, { passive: false });

  handle.addEventListener('touchend', (e) => {
    if (!ghost) return;
    wrap.classList.remove('dragging');
    ghost.remove(); ghost = null;
    $('roster').querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));

    const rEl = $('roster');
    const siblings = Array.from(rEl.querySelectorAll(`.roster-card-wrap[data-section="${section}"]`));
    const fingerY = e.changedTouches[0].clientY;

    let targetIdx = startIdx;
    siblings.forEach((el, i) => {
      if (el === wrap) return;
      const rect = el.getBoundingClientRect();
      if (fingerY > rect.top + rect.height / 2) targetIdx = i;
    });

    if (targetIdx === startIdx) return;

    if (section === 'party') {
      const p = getParty();
      const party = p.filter(n => getRoster().some(e => e.char === n));
      const moved = party.splice(startIdx, 1)[0];
      party.splice(targetIdx, 0, moved);
      // Rebuild full party array preserving any non-roster members
      setParty(party);
    } else {
      const r = getRoster();
      const retinue = r.filter(e => !getParty().includes(e.char));
      const moved = retinue.splice(startIdx, 1)[0];
      retinue.splice(targetIdx, 0, moved);
      // Rebuild full roster preserving party members
      const party = getParty();
      const partyEntries = r.filter(e => party.includes(e.char));
      setRoster([...partyEntries, ...retinue]);
    }
    renderTracker();
  });
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
    empty.textContent = '— no pick at this level —';
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
  $('sheet').classList.remove('open');
  $('sheet-back').classList.add('hidden');
  document.body.style.overflow = '';
}
// X always pops (closes sheet when at depth 1, goes back when deeper)
$('sheet-close').addEventListener('click', popSheet);
$('sheet-back').addEventListener('click', popSheet);
$('sheet-overlay').addEventListener('click', closeSheet);
// swipe-down to close
(() => {
  let startY = null;
  const sheet = $('sheet');
  sheet.addEventListener('touchstart', (e) => {
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
    meta.textContent = `${displayName} — joins at level ${joinLevel}.`;
    wrap.appendChild(meta);
    const empty = document.createElement('div');
    empty.className = 'desc-text-missing';
    empty.textContent = 'No pick yet — character not in party.';
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
      const block = document.createElement('div');
      block.className = 'desc-block';
      const nm = document.createElement('div');
      nm.className = 'desc-name';
      nm.textContent = (isExtra ? '+ ' : '') + rawPick;
      const src = document.createElement('div');
      src.className = 'desc-source';
      src.textContent = 'Skill / Stat allocation';
      const txt = document.createElement('div');
      txt.className = 'desc-text-missing';
      txt.textContent = 'A characteristic, skill, or AP allocation. No further description.';
      block.appendChild(nm); block.appendChild(src); block.appendChild(txt);
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
      nm.textContent = (isExtra && i === 0 ? '+ ' : '') + hit.name + (hit.tierStripped ? ` — ${rawPick}` : '');
      const src = document.createElement('div');
      src.className = 'desc-source';
      src.textContent = hit.kind;
      const txt = document.createElement('div');
      txt.className = 'desc-text';
      txt.textContent = hit.desc;
      block.appendChild(nm); block.appendChild(src); block.appendChild(txt);
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
  wrap.appendChild(meta);

  // Party button (companions only)
  if (isCompanion && rosterHas(displayName)) {
    const partyBtn = document.createElement('button');
    const updatePartyBtn = () => {
      const inP = inParty(displayName);
      partyBtn.className = 'party-toggle-btn' + (inP ? ' in-party' : '');
      partyBtn.textContent = inP ? '★ In Party — Remove' : `☆ Add to Party${getParty().length >= MAX_PARTY ? ' (party full)' : ''}`;
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

  // Decide whether to show tabs (only when there are extras to put in the second tab)
  const extras = getExtrasForBuildName(buildName, isCompanion);
  const hasExtras = extras && (extras.skills || (extras.gear && extras.gear.length));

  let timelinePanel, gearPanel;
  if (hasExtras) {
    const tabBar = document.createElement('div');
    tabBar.className = 'tab-bar';
    const tabTimeline = document.createElement('button');
    tabTimeline.className = 'tab-btn active';
    tabTimeline.textContent = 'Timeline';
    const tabGear = document.createElement('button');
    tabGear.className = 'tab-btn';
    tabGear.textContent = 'Gear & Skills';
    tabBar.appendChild(tabTimeline);
    tabBar.appendChild(tabGear);
    wrap.appendChild(tabBar);

    timelinePanel = document.createElement('div');
    gearPanel = document.createElement('div');
    gearPanel.classList.add('hidden');

    tabTimeline.addEventListener('click', () => {
      tabTimeline.classList.add('active'); tabGear.classList.remove('active');
      timelinePanel.classList.remove('hidden'); gearPanel.classList.add('hidden');
    });
    tabGear.addEventListener('click', () => {
      tabGear.classList.add('active'); tabTimeline.classList.remove('active');
      gearPanel.classList.remove('hidden'); timelinePanel.classList.add('hidden');
    });
  } else {
    timelinePanel = document.createElement('div');
  }

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
    if (entry.m) {
      const m = document.createElement('div');
      m.className = 'timeline-main';
      if (entry.m.includes('/') || pickHasInfo(entry.m)) {
        m.classList.add('has-info');
        m.addEventListener('click', () => pushSinglePickDescription(entry.m, displayName, n));
      }
      renderStyledPickText(entry.m, choices, n, m);
      pickCol.appendChild(m);
    }
    if (entry.e) {
      const ex = document.createElement('div');
      ex.className = 'timeline-extra';
      if (entry.e.includes('/') || pickHasInfo(entry.e)) {
        ex.classList.add('has-info');
        ex.addEventListener('click', () => pushSinglePickDescription(entry.e, displayName, n));
      }
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

  // === Gear & Skills panel ===
  if (hasExtras) {
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

  // Slash pick → show choice selector (same as description sheet)
  if (rawPick.includes('/')) {
    renderChoiceSection(rawPick, displayName, atLevel, wrap, false);
    return wrap;
  }

  if (isSkillStatPick(rawPick)) {
    const block = document.createElement('div');
    block.className = 'desc-block';
    const nm = document.createElement('div');
    nm.className = 'desc-name';
    nm.textContent = rawPick;
    const src = document.createElement('div');
    src.className = 'desc-source';
    src.textContent = 'Skill / Stat allocation';
    const txt = document.createElement('div');
    txt.className = 'desc-text-missing';
    txt.textContent = 'A characteristic, skill, or AP allocation.';
    block.appendChild(nm); block.appendChild(src); block.appendChild(txt);
    wrap.appendChild(block);
  } else {
    const hits = lookupPick(rawPick);
    if (hits.length === 0) {
      const block = document.createElement('div');
      block.className = 'desc-block';
      const nm = document.createElement('div');
      nm.className = 'desc-name';
      nm.textContent = rawPick;
      const txt = document.createElement('div');
      txt.className = 'desc-text-missing';
      txt.textContent = 'No description available.';
      block.appendChild(nm); block.appendChild(txt);
      wrap.appendChild(block);
    } else {
      hits.forEach(hit => {
        const block = document.createElement('div');
        block.className = 'desc-block';
        const nm = document.createElement('div');
        nm.className = 'desc-name';
        nm.textContent = hit.name + (hit.tierStripped ? ` — ${rawPick}` : '');
        const src = document.createElement('div');
        src.className = 'desc-source';
        src.textContent = hit.kind;
        const txt = document.createElement('div');
        txt.className = 'desc-text';
        txt.textContent = hit.desc;
        block.appendChild(nm); block.appendChild(src); block.appendChild(txt);
        wrap.appendChild(block);
      });
    }
  }
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

const SECTION_META = {
  tracker:   { title: 'Rogue Trader',    subtitle: 'Level Tracker & Build Companion' },
  colony:    { title: 'Colony Projects', subtitle: 'Track your colonial development' },
  traders:   { title: 'Traders',         subtitle: 'Faction reputations & available items' },
  resources: { title: 'Resources',       subtitle: 'Star system resources' },
  notes:     { title: 'Notes',           subtitle: 'Campaign notes & reminders' },
};

function showSection(name) {
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
  if (name === 'tracker')   renderTracker();
  else if (name === 'colony')    renderColonySection();
  else if (name === 'traders')   renderTradersSection();
  else if (name === 'resources') renderResourcesSection();
  else if (name === 'notes')     renderNotesSection();
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

// ============= COLONY PROJECTS =============

const KEY_COLONY_DONE  = 'rt.colony-done.v1';
const KEY_COLONY_LEVEL = 'rt.colony-level.v1';

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

let _selectedColony = 0;

function renderColonySection() {
  const el = $('colony-content');
  el.innerHTML = '';
  if (!DATA.colonies || !DATA.colonies.length) {
    el.textContent = 'No colony data available.';
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
          // Open modal sheet with project details
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
function noteSnippet(content) {
  const lines = (content || '').split('\n').filter(l => l.trim());
  const body = lines.slice(1, 3).join(' ').replace(/[#*`_]/g, '');
  return body.slice(0, 100) || '';
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
const KEY_NOTES_HISTORY = 'rt.notes-history.v1';
const MAX_UNDO = 20;
const _historyCache = new Map(); // noteId → [content, ...] (in-memory mirror)

function _loadHistory() {
  if (_historyCache.size) return;
  const raw = Store.get(KEY_NOTES_HISTORY) || {};
  for (const [id, arr] of Object.entries(raw)) _historyCache.set(id, arr);
}
function _saveHistory() {
  const obj = {};
  _historyCache.forEach((arr, id) => { if (arr.length) obj[id] = arr; });
  Store.set(KEY_NOTES_HISTORY, obj);
}
function historyPush(noteId, content) {
  _loadHistory();
  if (!_historyCache.has(noteId)) _historyCache.set(noteId, []);
  const h = _historyCache.get(noteId);
  if (h.length && h[h.length - 1] === content) return;
  h.push(content);
  if (h.length > MAX_UNDO) h.shift();
  _saveHistory();
}
function historyPop(noteId) {
  _loadHistory();
  const h = _historyCache.get(noteId);
  if (!h || !h.length) return null;
  const val = h.pop();
  _saveHistory();
  return val;
}
function historyLen(noteId) {
  _loadHistory();
  return (_historyCache.get(noteId) || []).length;
}
// Prune history for deleted notes to avoid unbounded growth
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

  const hint = document.createElement('div');
  hint.className = 'note-swipe-hint ' + (isArchived ? 'hint-right' : 'hint-left');
  hint.textContent = isArchived ? '↩ Restore' : '🗄 Archive';
  outer.appendChild(hint);

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
  card.addEventListener('click', () => openNoteEditor(note));
  outer.appendChild(card);

  // Swipe to archive/restore
  let startX = 0, startY = 0, dx = 0, swiping = false;
  const THRESHOLD = 80;
  card.addEventListener('touchstart', e => {
    startX = e.touches[0].clientX; startY = e.touches[0].clientY; dx = 0; swiping = false;
  }, { passive: true });
  card.addEventListener('touchmove', e => {
    dx = e.touches[0].clientX - startX;
    const dy = e.touches[0].clientY - startY;
    if (!swiping && Math.abs(dy) > Math.abs(dx)) return;
    swiping = true;
    const ok = isArchived ? dx > 0 : dx < 0;
    if (ok) card.style.transform = `translateX(${dx}px)`;
  }, { passive: true });
  card.addEventListener('touchend', () => {
    card.style.transition = 'transform 0.2s';
    card.style.transform = '';
    setTimeout(() => { card.style.transition = ''; }, 220);
    if (!swiping) return;
    if (!isArchived && dx < -THRESHOLD) {
      note.archived = true;
      const all = getNotes(); const i = all.findIndex(n => n.id === note.id);
      if (i >= 0) { all[i] = note; setNotes(all); }
      renderNotesSection();
    } else if (isArchived && dx > THRESHOLD) {
      note.archived = false;
      note.updatedAt = Date.now(); // bump to top
      const all = getNotes(); const i = all.findIndex(n => n.id === note.id);
      if (i >= 0) { all[i] = note; setNotes(all); }
      renderNotesSection();
    }
    dx = 0;
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
  const previewBtn = document.createElement('button');
  previewBtn.className = 'note-tool-btn note-preview-btn';

  const fmtButtons = [
    { label: 'B',  title: 'Bold',        wrap: ['**','**'] },
    { label: 'I',  title: 'Italic',      wrap: ['*','*'] },
    { label: 'H1', title: 'Heading 1',   prefix: '# ' },
    { label: 'H2', title: 'Heading 2',   prefix: '## ' },
    { label: '•',  title: 'List item',   prefix: '- ' },
    { label: '☐',  title: 'Todo item',   prefix: '- [ ] ' },
    { label: '—',  title: 'Divider',     insert: '\n---\n' },
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

  // Save indicator
  const saveIndicator = document.createElement('span');
  saveIndicator.className = 'note-save-indicator';
  let fadeTimer = null;
  const flashSaved = () => {
    saveIndicator.classList.add('visible');
    clearTimeout(fadeTimer);
    fadeTimer = setTimeout(() => saveIndicator.classList.remove('visible'), 1200);
  };

  // Undo button (declared here, updated after history changes)
  const undoBtn = document.createElement('button');
  undoBtn.className = 'note-tool-btn note-undo-btn';
  undoBtn.textContent = '↩';
  undoBtn.title = 'Undo';
  const updateUndoBtn = () => { undoBtn.disabled = historyLen(note.id) === 0; };
  updateUndoBtn();

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
    updateUndoBtn();
  };
  const save = () => { clearTimeout(saveTimer); saveTimer = setTimeout(commitSave, 600); };

  textarea.addEventListener('input', () => {
    // Snapshot BEFORE the debounce fires so undo restores to last persisted state
    historyPush(note.id, note.content);
    updateUndoBtn();
    save();
  });
  textarea.addEventListener('blur', () => {
    clearTimeout(saveTimer);
    if (textarea.value !== note.content) commitSave();
  });

  undoBtn.addEventListener('click', () => {
    const prev = historyPop(note.id);
    if (prev == null) return;
    textarea.value = prev;
    clearTimeout(saveTimer);
    commitSave();
    if (previewMode) refreshPreview();
  });

  const refreshPreview = () => { preview.innerHTML = renderMarkdown(textarea.value); };

  const applyMode = () => {
    if (previewMode) {
      refreshPreview();
      preview.classList.remove('hidden');
      textarea.classList.add('hidden');
      // Hide format buttons in preview mode
      toolbar.querySelectorAll('.note-fmt-btn').forEach(b => b.classList.add('hidden'));
      previewBtn.textContent = 'Edit';
      previewBtn.classList.add('active');
    } else {
      preview.classList.add('hidden');
      textarea.classList.remove('hidden');
      toolbar.querySelectorAll('.note-fmt-btn').forEach(b => b.classList.remove('hidden'));
      previewBtn.textContent = 'Preview';
      previewBtn.classList.remove('active');
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
      const end = textarea.selectionEnd;
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
  toolbar.appendChild(saveIndicator);
  toolbar.appendChild(previewBtn);

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'note-tool-btn note-delete-btn';
  deleteBtn.textContent = '🗑';
  deleteBtn.title = 'Delete note';
  deleteBtn.addEventListener('click', () => {
    const notes = getNotes().filter(n => n.id !== note.id);
    setNotes(notes);
    pruneHistory(new Set(notes.map(n => String(n.id))));
    closeSheet();
    renderNotesSection();
  });
  toolbar.appendChild(deleteBtn);

  // Todo tap in preview
  preview.addEventListener('click', (e) => {
    const item = e.target.closest('.todo-item');
    if (!item) return;
    const lineIdx = parseInt(item.dataset.line, 10);
    const lines = textarea.value.split('\n');
    const line = lines[lineIdx];
    if (/^- \[x\] /i.test(line)) lines[lineIdx] = line.replace(/^- \[x\] /i, '- [ ] ');
    else if (/^- \[ \] /.test(line)) lines[lineIdx] = line.replace(/^- \[ \] /, '- [x] ');
    textarea.value = lines.join('\n');
    historyPush(note.id, note.content); // snapshot before commit
    clearTimeout(saveTimer);
    commitSave();
    refreshPreview();
  });

  previewBtn.addEventListener('click', () => {
    previewMode = !previewMode;
    applyMode();
  });

  wrap.append(toolbar, textarea, preview);

  // Initialise mode after elements are in DOM (via requestAnimationFrame post-openSheet)
  requestAnimationFrame(applyMode);
  return wrap;
}

// ============= RESOURCES =============

const RESOURCE_TYPES = ['people','provisions','chemicals','plasteel','mechanisms','promethium','weapons','xenotech','adamantine','flogiston'];

let _resourceTab      = 'system';
let _selectedSystem   = null;
let _selectedResource = null;

function renderResourcesSection() {
  const el = $('resources-content');
  el.innerHTML = '';
  if (!DATA.resourceSystems || !DATA.resourceSystems.length) { el.textContent = 'No resource data.'; return; }

  // Tab bar
  const tabBar = document.createElement('div');
  tabBar.className = 'tab-bar';
  ['system', 'resource'].forEach(tab => {
    const btn = document.createElement('button');
    btn.className = 'tab-btn' + (_resourceTab === tab ? ' active' : '');
    btn.textContent = tab === 'system' ? 'By System' : 'By Resource';
    btn.addEventListener('click', () => { _resourceTab = tab; renderResourcesSection(); });
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
    nameEl.textContent = system.name;
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
      item.append(nameEl, sub);
    } else {
      item.appendChild(nameEl);
    }
    item.addEventListener('click', () => {
      _selectedSystem = isSelected ? null : system.name;
      renderResourcesSection();
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
    item.innerHTML = `<div class="selectable-item-name">${label}</div>
      <div class="selectable-item-sub">${entries.length} system${entries.length !== 1 ? 's' : ''} · best: ${entries[0].system} ×${entries[0].qtyNum}</div>`;
    item.addEventListener('click', () => {
      _selectedResource = isSelected ? null : resType;
      renderResourcesSection();
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
    sheet.style.maxHeight = '';
    const ta = sheet.querySelector('.note-textarea');
    if (ta) { ta.style.height = ''; ta.style.minHeight = ''; }
  };
  const onVVChange = () => {
    if (!sheet.classList.contains('open')) return;
    const vv = window.visualViewport;
    const keyboardH = Math.max(0, window.innerHeight - (vv.offsetTop + vv.height));
    if (keyboardH > 50) {
      sheet.style.bottom    = keyboardH + 'px';
      sheet.style.maxHeight = vv.height + 'px';
      // Shrink textarea to exactly fill remaining space above keyboard
      const ta = sheet.querySelector('.note-textarea:not(.hidden)');
      if (ta) {
        const grabberH   = sheet.querySelector('.sheet-grabber')?.offsetHeight  || 16;
        const headerH    = sheet.querySelector('.sheet-header')?.offsetHeight   || 52;
        const toolbarH   = sheet.querySelector('.note-toolbar')?.offsetHeight   || 50;
        const bodyPadV   = 32; // 16px top + 16px bottom from .sheet-body padding
        const taH = Math.max(80, vv.height - grabberH - headerH - toolbarH - bodyPadV);
        ta.style.minHeight = taH + 'px';
        ta.style.height    = taH + 'px';
      }
    } else {
      resetSheet();
    }
  };
  window.visualViewport.addEventListener('resize', onVVChange);
  window.visualViewport.addEventListener('scroll', onVVChange);
  document.getElementById('sheet-overlay').addEventListener('click', resetSheet);
  document.getElementById('sheet-close').addEventListener('click', resetSheet);
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(err => console.warn('SW registration failed:', err));
  });
}
