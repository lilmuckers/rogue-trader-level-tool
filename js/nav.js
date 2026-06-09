// ============= SECTION NAVIGATION =============
let _activeSection = 'tracker';
let _reorderMode = false;

// ── Deep-link hash routing ─────────────────────────────────────────────────────
let _settingHash = false;

function _pushHash(section, sub) {
  _settingHash = true;
  const hash = sub ? `#${section}/${sub}` : `#${section}`;
  history.replaceState(null, '', hash);
  _settingHash = false;
}

function _parseHash() {
  const raw = location.hash.replace(/^#/, '');
  if (!raw) return { section: 'tracker', sub: null };
  const parts = raw.split('/');
  return { section: parts[0] || 'tracker', sub: parts[1] || null };
}

function _hashSubFor(sectionName) {
  if (sectionName === 'reference') return _referenceSubSection || null;
  if (sectionName === 'colony')    return getHoldingsTab();
  return null;
}

window.addEventListener('hashchange', () => {
  if (_settingHash) return;
  const { section, sub } = _parseHash();
  if (!SECTION_META[section]) return; // unknown section — ignore
  if (sub) {
    if (section === 'reference') { _referenceSubSection = sub; showSection('reference'); }
    else if (section === 'colony') { setHoldingsTab(sub); showSection('colony'); }
    else showSection(section);
  } else {
    if (section === 'reference') _referenceSubSection = null;
    showSection(section);
  }
});

function setReorderMode(on) {
  _reorderMode = on;
  $('roster').classList.toggle('reorder-active', on);
  const btn = $('reorder-btn');
  if (btn) {
    btn.textContent = on ? '✓ Done' : '⇅ Reorder';
    btn.classList.toggle('active', on);
  }
}

const SECTION_META = {
  tracker:   { title: 'Rogue Trader',    subtitle: 'Level Tracker & Build Companion' },
  colony:    { title: 'Holdings', subtitle: 'Colonies &amp; Voidship upgrades' },
  traders:   { title: 'Traders',         subtitle: 'Faction reputations & available items' },
  reference: { title: 'Reference',       subtitle: 'Lookup tables & reference data' },
  notes:     { title: 'Notes',           subtitle: 'Campaign notes & reminders' },
  workshop:  { title: 'Workshop',        subtitle: 'Custom build manager' },
};

function showSection(name) {
  if (name !== 'tracker') setReorderMode(false);
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
  if (name === 'tracker')        renderTracker();
  else if (name === 'colony')    renderColonySection();
  else if (name === 'traders')   renderTradersSection();
  else if (name === 'reference') renderReferenceSection();
  else if (name === 'notes')     renderNotesSection();
  else if (name === 'workshop')  { _wsStep = 'manager'; renderWorkshopSection(); }
  _pushHash(name, _hashSubFor(name));
}

document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    // Reset sub-section state when user explicitly clicks a nav button
    if (btn.dataset.section === 'reference') _referenceSubSection = null;
    showSection(btn.dataset.section);
  });
});

function showTracker() { showSection('tracker'); }
function showSetup() {
  document.querySelectorAll('.section-view').forEach(el => el.classList.add('hidden'));
  $('setup-view').classList.remove('hidden');
  renderSetup();
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
$('reorder-btn').addEventListener('click', () => setReorderMode(!_reorderMode));
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

function _initFromHash() {
  const { section, sub } = _parseHash();
  if (!SECTION_META[section]) { showSection('tracker'); return; }
  if (sub) {
    if (section === 'reference') _referenceSubSection = sub;
    else if (section === 'colony') setHoldingsTab(sub);
  }
  showSection(section);
}

if (!config) showSetup(); else _initFromHash();
