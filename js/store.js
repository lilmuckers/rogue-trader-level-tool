// ============= STORAGE =============
const Store = (() => {
  let memory = {}; let useLS = false;
  try { localStorage.setItem('__t__','1'); localStorage.removeItem('__t__'); useLS = true; } catch (e) {}
  return {
    get(k) { if (useLS) { const v = localStorage.getItem(k); return v == null ? null : JSON.parse(v); } return k in memory ? memory[k] : null; },
    set(k, v) { if (useLS) localStorage.setItem(k, JSON.stringify(v)); else memory[k] = v; },
    remove(k) { if (useLS) localStorage.removeItem(k); else delete memory[k]; },
    // Mutate a stored object in-place: fn(obj) → save back.
    mutate(k, fn) { const obj = this.get(k) || {}; fn(obj); this.set(k, obj); },
  };
})();

// ── All localStorage keys (single source of truth) ────────────────────────────
const KEY_CONFIG        = 'rt.config.v2';
const KEY_LEVEL         = 'rt.level.v1';
const KEY_CHOICES       = 'rt.choices.v1';
const KEY_MC_NAME       = 'rt.mc-name.v1';
const KEY_ROSTER        = 'rt.roster.v1';
const KEY_PARTY         = 'rt.party.v1';
const KEY_NOTES         = 'rt.notes.v1';
const KEY_NOTES_SORT    = 'rt.notes-sort.v1';
const KEY_NOTES_HISTORY = 'rt.notes-history.v2';
const KEY_TRADERS_ACT   = 'rt.traders-act.v1';
const KEY_TRADERS_REP   = 'rt.traders-rep.v1';
const KEY_PROFIT_FACTOR = 'rt.profit-factor.v1';
const KEY_ALIGN_RANKS   = 'rt.align-ranks.v1';
const KEY_COLONY_DONE   = 'rt.colony-done.v1';
const KEY_COLONY_LEVEL  = 'rt.colony-level.v1';
const KEY_VOIDSHIP_DONE = 'rt.voidship-done.v1';
const KEY_VOIDSHIP_NAME = 'rt.voidship-name.v1';
const KEY_VOIDSHIP_RANK = 'rt.voidship-rank.v1';
const KEY_HOLDINGS_TAB  = 'rt.holdings-tab.v1';
const KEY_CUSTOM_BUILDS = 'rt-custom-builds';
const KEY_GIST_PAT      = 'rt-gist-pat';
const KEY_REF_FAVS      = 'rt-ref-favourites';

const MIN_LVL = 1, MAX_LVL = 55;
const MAX_PARTY = 5;
