// ============= REFERENCE =============

let _referenceSubSection = null; // null = landing, 'resources' = star systems

const REFERENCE_SECTIONS = [
  { id: 'gear',        title: 'Gear Browser',          subtitle: 'Browse all gear by slot, DLC, character, or act', icon: '⚔' },
  { id: 'retinue',     title: 'Retinue',                subtitle: 'Companion profiles, bios, base stats & wiki links', icon: '👥' },
  { id: 'mcbuilds',    title: 'MC Builds',              subtitle: 'All playable MC builds grouped by theme',          icon: '⚜' },
  { id: 'charcreate',  title: 'Character Creation',     subtitle: 'Homeworlds, origins and stat bonuses',             icon: '🌍' },
  { id: 'abilities',   title: 'Abilities',              subtitle: 'All ability descriptions, searchable',             icon: '✦' },
  { id: 'talents',     title: 'Talents',                subtitle: 'All talent descriptions, searchable',              icon: '◈' },
  { id: 'skills',      title: 'Skills & Characteristics', subtitle: 'Reference for all stats and skills',            icon: '📊' },
  { id: 'resources',   title: 'Star System Resources',  subtitle: 'Resource deposits by system or type',             icon: '⬡' },
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
    else if (_referenceSubSection === 'retinue')    renderRetinueSection(subEl);
  } else {
    // Landing: cards for each sub-section
    const grid = document.createElement('div');
    grid.className = 'reference-grid';
    REFERENCE_SECTIONS.forEach(({ id, title, subtitle, icon }) => {
      const card = document.createElement('div');
      card.className = 'reference-card';
      card.innerHTML = `<div class="reference-card-icon">${icon}</div>
        <div class="reference-card-title">${title}</div>
        <div class="reference-card-sub">${subtitle}</div>`;
      card.addEventListener('click', () => { _referenceSubSection = id; renderReferenceSection(); });
      grid.appendChild(card);
    });
    el.appendChild(grid);
  }
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

