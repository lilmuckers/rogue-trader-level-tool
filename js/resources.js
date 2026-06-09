// ============= REFERENCE =============

let _referenceSubSection = null;
let _referenceSearch = '';

// ── Favourites ────────────────────────────────────────────────────────────────
// KEY_ constants are in store.js
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
    const resultsEl = document.createElement('div');
    const doSearch = (q) => {
      _referenceSearch = q;
      if (q) { resultsEl.innerHTML = ''; _renderGlobalSearchResults(resultsEl, q); }
      else _renderReferenceLandingGrid(resultsEl);
    };
    const { wrap: searchWrap } = _makeSearchBar('Search all reference…', doSearch, {
      wrapClass: 'ref-global-search-wrap',
      inputClass: 'ref-global-search',
      clearClass: 'lib-search-clear',
      initValue: _referenceSearch,
    });

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
    el.appendChild(_makeEmptyState('No results across any section.'));
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

  el.appendChild(_makeTabBar(
    [{ id: 'system', label: 'By System' }, { id: 'resource', label: 'By Resource' }],
    _resourceTab,
    id => { _resourceTab = id; renderReferenceSection(); }
  ));

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

