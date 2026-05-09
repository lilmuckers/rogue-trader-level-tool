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
