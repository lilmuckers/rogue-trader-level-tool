const DEFAULT_JOIN_LEVELS = {"Abelard": 1, "Idira": 1, "Argenta": 3, "Pasqal": 6, "Cassia": 10, "Heinrix": 12, "Yrliet": 14, "Jae": 16, "Ulfar": 22, "Marazhai": 31, "Kibellah": 33, "Solomorne": 37, "Incendia Chorda": 40, "Calligos Winterscale": 40, "Uralon": 40};

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

const KEY_CONFIG = 'rt.config.v2';
const KEY_LEVEL = 'rt.level.v1';
const KEY_CHOICES = 'rt.choices.v1';
const MIN_LVL = 1, MAX_LVL = 55;

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

  const roster = $('roster');
  roster.innerHTML = '';

  const mc = getCurrentMC();
  if (mc) {
    roster.appendChild(charCard({
      mc: true, key: 'Rogue Trader', displayName: 'Rogue Trader',
      buildName: mc.name, arch: detectArchetype(mc.origin) || '—',
      pick: pickAt(mc, level), available: true, build: mc,
    }));
  }

  const sectionH = document.createElement('div');
  sectionH.className = 'roster-heading';
  sectionH.textContent = '◆ Retinue ◆';
  roster.appendChild(sectionH);

  COMPANION_ORDER.forEach(charName => {
    const variant = getCompanionVariant(charName);
    if (!variant) return;
    const join = getJoinLevel(charName);
    const available = level >= join;
    roster.appendChild(charCard({
      mc: false, key: charName, displayName: charName,
      buildName: variant.name, arch: COMPANION_ARCH[charName] || '',
      pick: available ? pickAt(variant, level) : null,
      available, joinLevel: join, build: variant,
    }));
  });
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

  const cWrap = $('companion-selects');
  cWrap.innerHTML = '';
  COMPANION_ORDER.forEach(charName => {
    const variants = DATA.companions[charName];
    if (!variants || variants.length === 0) return;
    const row = document.createElement('div');
    row.className = 'setup-row companion-setup-row';
    const lbl = document.createElement('label');
    lbl.className = 'setup-label';
    lbl.textContent = charName + ' · ' + (COMPANION_ARCH[charName] || '');
    lbl.htmlFor = 'comp-' + charName;
    row.appendChild(lbl);
    const grid = document.createElement('div');
    grid.className = 'companion-setup-grid';
    const sel = document.createElement('select');
    sel.id = 'comp-' + charName;
    sel.dataset.char = charName;
    const curIdx = (config && config.companions && config.companions[charName] != null) ? config.companions[charName] : 0;
    variants.forEach((v, i) => {
      const o = document.createElement('option');
      o.value = i; o.textContent = v.name;
      if (i === curIdx) o.selected = true;
      sel.appendChild(o);
    });
    if (variants.length === 1) { sel.disabled = true; sel.style.opacity = '0.7'; }
    grid.appendChild(sel);
    const joinWrap = document.createElement('div');
    joinWrap.className = 'join-input-wrap';
    const joinLbl = document.createElement('div');
    joinLbl.className = 'join-input-label';
    joinLbl.textContent = 'Joins @';
    const joinInput = document.createElement('input');
    joinInput.type = 'number';
    joinInput.min = 1; joinInput.max = 55;
    joinInput.dataset.char = charName;
    joinInput.dataset.role = 'join';
    joinInput.value = getJoinLevel(charName);
    joinWrap.appendChild(joinLbl);
    joinWrap.appendChild(joinInput);
    grid.appendChild(joinWrap);
    row.appendChild(grid);
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
function vendorItemAvailable(item, rep, act) {
  if (act < item.act) return false;
  if (typeof item.rep === 'number') return rep >= item.rep;
  return true;  // text rep (alignment-based) — always show
}
function vendorItemLockReason(item, rep, act) {
  if (act < item.act) return `Available in Act ${item.act}`;
  if (typeof item.rep === 'number' && rep < item.rep) return `Requires rep ${item.rep}`;
  if (typeof item.rep === 'string') return `Requires: ${item.rep}`;
  return null;
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

  const query = _traderSearchText.trim().toLowerCase();
  if (query.length >= 2) {
    // Search results mode
    const matches = [];
    DATA.vendors.forEach(faction => {
      faction.items.forEach(item => {
        if (item.name.toLowerCase().includes(query)) matches.push({ item, factionName: faction.name });
      });
    });
    if (!matches.length) {
      const empty = document.createElement('div');
      empty.style.cssText = 'color:var(--ink-dim);padding:12px 0;font-size:15px;';
      empty.textContent = 'No items found.';
      el.appendChild(empty);
    } else {
      matches.forEach(({ item, factionName }) => {
        const rep = getFactionRep(factionName);
        const available = vendorItemAvailable(item, rep, act);
        const row = document.createElement('div');
        row.className = 'search-result-item';
        row.innerHTML = `<div class="search-result-name">${item.name}</div>
          <div class="search-result-meta">
            <span>${factionName}</span> · Rep <span>${item.rep}</span> · Act <span>${item.act}</span>
            ${!available ? '<em style="color:var(--ink-faint)"> (locked)</em>' : ''}
          </div>`;
        row.addEventListener('click', () => {
          _traderSearchText = '';
          const faction = DATA.vendors.find(f => f.name === factionName);
          openFactionSheet(faction, act, item.name);
        });
        el.appendChild(row);
      });
    }
    return;
  }

  // Faction list
  DATA.vendors.forEach(faction => {
    const rep = getFactionRep(faction.name);
    const availCount = faction.items.filter(it => vendorItemAvailable(it, rep, act)).length;
    const card = document.createElement('div');
    card.className = 'faction-card';
    card.innerHTML = `<div class="faction-card-header">
      <div class="faction-name">${faction.name}</div>
      <div class="faction-rep-badge">Rep ${rep}</div>
      <div class="faction-available-count">${availCount} available</div>
    </div>`;
    card.addEventListener('click', () => openFactionSheet(faction, act, null));
    el.appendChild(card);
  });
}

function openFactionSheet(faction, act, scrollToItem) {
  openSheet(faction.name, () => buildFactionContent(faction, act, scrollToItem));
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
  el.innerHTML = `<div class="vendor-item-name">${item.name}</div>
    <div class="vendor-item-meta">Rep ${item.rep} · Act ${item.act}${item.pf ? ` · PF ${item.pf}` : ''}</div>`;
  if (!available) {
    const lock = document.createElement('div');
    lock.className = 'vendor-item-lock-reason';
    lock.textContent = vendorItemLockReason(item, getFactionRep(factionName), getTradersAct()) || '';
    el.appendChild(lock);
  }
  if (available) {
    el.addEventListener('click', () => {
      const found = lookupGear(item.name.replace(/\s*\(.*?\)\s*$/, '').trim());
      if (found) pushGearDetail(found, item.name);
    });
  }
  return el;
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
$('save-btn').addEventListener('click', () => {
  const theme = $('mc-theme-select').value;
  const buildIndex = parseInt($('mc-build-select').value, 10);
  const companions = {};
  document.querySelectorAll('#companion-selects select').forEach(sel => {
    companions[sel.dataset.char] = parseInt(sel.value, 10);
  });
  const joinLevels = {};
  document.querySelectorAll('input[data-role="join"]').forEach(inp => {
    let n = parseInt(inp.value, 10);
    if (isNaN(n) || n < 1) n = 1;
    if (n > 55) n = 55;
    joinLevels[inp.dataset.char] = n;
  });
  config = { mc: { theme, buildIndex }, companions, joinLevels };
  Store.set(KEY_CONFIG, config);
  showTracker();
});
$('reset-btn').addEventListener('click', () => {
  if (!confirm('Erase your saved roster, join levels, and current level?')) return;
  Store.remove(KEY_CONFIG); Store.remove(KEY_LEVEL);
  config = null; level = 1;
  showSetup();
});
// Close sheet with ESC (or pop back if drilled in)
window.addEventListener('keydown', (e) => { if (e.key === 'Escape') popSheet(); });

if (!config) showSetup(); else showTracker();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(err => console.warn('SW registration failed:', err));
  });
}
