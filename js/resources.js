// ============= REFERENCE =============

let _referenceSubSection = null;
let _referenceSearch = '';

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
    item.innerHTML = `<div class="selectable-item-name">${label}</div>
      <div class="selectable-item-sub">${entries.length} system${entries.length !== 1 ? 's' : ''} · best: ${entries[0].system} ×${entries[0].qtyNum}</div>`;
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

