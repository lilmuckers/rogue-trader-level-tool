document.addEventListener('contextmenu', e => e.preventDefault());

// ── Shared DOM helpers ─────────────────────────────────────────────────────────

// Search input + clear button.
// opts: { wrapClass, inputClass, clearClass, initValue }
// Returns { wrap, inp }.
function _makeSearchBar(placeholder, onInput, {
  wrapClass  = 'lib-search-wrap',
  inputClass = 'lib-search',
  clearClass = 'lib-search-clear',
  initValue  = '',
} = {}) {
  const wrap = document.createElement('div');
  wrap.className = wrapClass;
  const inp = document.createElement('input');
  inp.type = 'text'; inp.className = inputClass;
  inp.placeholder = placeholder; inp.value = initValue;
  inp.setAttribute('autocorrect', 'off'); inp.setAttribute('spellcheck', 'false');
  const clear = document.createElement('button');
  clear.className = clearClass; clear.textContent = '✕'; clear.title = 'Clear search';
  clear.style.display = initValue ? '' : 'none';
  inp.addEventListener('input', () => {
    clear.style.display = inp.value ? '' : 'none';
    onInput(inp.value);
  });
  clear.addEventListener('click', () => {
    inp.value = ''; clear.style.display = 'none'; inp.focus(); onInput('');
  });
  wrap.append(inp, clear);
  return { wrap, inp };
}

// Empty-state placeholder div.
function _makeEmptyState(text, className = 'gb-empty') {
  const el = document.createElement('div');
  el.className = className;
  el.textContent = text;
  return el;
}

// Generic tab bar. tabs = [{id, label}]. Returns bar element.
function _makeTabBar(tabs, activeId, onChange, barClass = 'tab-bar', btnClass = 'tab-btn') {
  const bar = document.createElement('div');
  bar.className = barClass;
  tabs.forEach(({ id, label }) => {
    const btn = document.createElement('button');
    btn.className = btnClass + (id === activeId ? ' active' : '');
    btn.setAttribute('type', 'button');
    btn.textContent = label;
    btn.addEventListener('click', () => {
      bar.querySelectorAll('.' + btnClass).forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      onChange(id);
    });
    bar.appendChild(btn);
  });
  return bar;
}

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
