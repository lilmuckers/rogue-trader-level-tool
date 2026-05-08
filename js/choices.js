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
