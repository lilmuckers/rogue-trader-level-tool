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
  augment: 'Augments',
};

// Shields are weapons with category: Shield — separate group
const SLOT_ORDER = ['armour','weapon','shield','helm','cloak','gloves','boots','neck','trinket','familiar','augment'];
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

  const { wrap: searchRow } = _makeSearchBar('Search gear…',
    val => { _gb.search = val; renderGearList(listEl); },
    { wrapClass: 'gb-search-row', inputClass: 'gb-search', clearClass: 'gb-search-clear', initValue: _gb.search });
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
    ['The Infinite Museion', 'The Infinite Museion'],
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
    listEl.appendChild(_makeEmptyState('No gear matches these filters.'));
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
