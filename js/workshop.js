// ============= WORKSHOP — Custom Build Manager =============

const KEY_CUSTOM_BUILDS = 'rt-custom-builds';
const KEY_GIST_PAT      = 'rt-gist-pat';

const WS_BASIC_ARCHETYPES    = ['Warrior','Officer','Operative','Soldier','Bladedancer'];
const WS_ADVANCED_ARCHETYPES = ['Assassin','Vanguard','Bounty Hunter','Master Tactician','Grand Strategist','Arch-Militant','Executioner','Overseer','Exemplar'];
const WS_ALL_ARCHETYPES      = [...WS_BASIC_ARCHETYPES, ...WS_ADVANCED_ARCHETYPES];

// ── Storage helpers ───────────────────────────────────────────────────────────
function getCustomBuilds()       { return Store.get(KEY_CUSTOM_BUILDS) || []; }
function saveCustomBuilds(b)     { Store.set(KEY_CUSTOM_BUILDS, b); }
function getGistPat()            { return Store.get(KEY_GIST_PAT) || ''; }
function saveGistPat(p)          { p ? Store.set(KEY_GIST_PAT, p) : Store.remove(KEY_GIST_PAT); }
function _genId()                { return 'cb_' + Date.now().toString(36) + Math.random().toString(36).slice(2,7); }

// ── Merge custom builds into DATA (call at init) ──────────────────────────────
function mergeCustomBuildsIntoData() {
  getCustomBuilds().forEach(b => {
    const entry = { _id: b._id, _custom: true, name: b.name, levels: b.levels || {} };
    if (b.dlc) entry.dlc = b.dlc;
    if (b._character === 'MC') {
      if (DATA.mc_builds.find(x => x._id === b._id)) return;
      entry.theme  = b.theme  || 'Custom';
      entry.origin = b.origin || '';
      DATA.mc_builds.push(entry);
      if (b.archetypes) DATA.archetypes.mc[b.name] = b.archetypes;
      if (b.extras)     DATA.extras.mc_extras[b.name] = b.extras;
    } else {
      const char = b._character;
      if (!DATA.companions[char]) DATA.companions[char] = [];
      if (DATA.companions[char].find(x => x._id === b._id)) return;
      DATA.companions[char].push(entry);
      if (b.archetypes) DATA.archetypes.comp[b.name] = b.archetypes;
      if (b.extras)     DATA.extras.comp_extras[b.name] = b.extras;
    }
  });
}

// ── Workshop state ────────────────────────────────────────────────────────────
// Steps: 'manager' | 'char-select' | 'setup' | 'levels' | 'import-preview'
let _wsStep         = 'manager';
let _wsDraft        = null;
let _wsImportData   = null;
let _wsImportSource = null;
let _wsExpandedLvl  = null;
let _wsStatusMsg    = null; // {text, ok} for feedback banners

// ── Main render ───────────────────────────────────────────────────────────────
function renderWorkshopSection() {
  const el = $('workshop-content');
  el.innerHTML = '';

  if (_wsStatusMsg) {
    const banner = document.createElement('div');
    banner.className = 'ws-banner ' + (_wsStatusMsg.ok ? 'ok' : 'err');
    banner.textContent = _wsStatusMsg.text;
    el.appendChild(banner);
    _wsStatusMsg = null;
  }

  if      (_wsStep === 'manager')        _renderManager(el);
  else if (_wsStep === 'char-select')    _renderCharSelect(el);
  else if (_wsStep === 'setup')          _renderSetup(el);
  else if (_wsStep === 'levels')         _renderLevels(el);
  else if (_wsStep === 'import-preview') _renderImportPreview(el);
}

// ── Manager screen ─────────────────────────────────────────────────────────────
function _renderManager(el) {
  _checkUrlSources(); // background sync

  // Action buttons
  const actions = document.createElement('div');
  actions.className = 'ws-actions';

  const mkBtn = (label, cls, onClick) => {
    const b = document.createElement('button');
    b.className = 'ws-action-btn' + (cls ? ' ' + cls : '');
    b.textContent = label;
    b.addEventListener('click', onClick);
    return b;
  };

  actions.appendChild(mkBtn('+ Build', 'primary', () => {
    _wsDraft = null; _wsStep = 'char-select'; renderWorkshopSection();
  }));
  actions.appendChild(mkBtn('+ From File', '', _importFromFile));
  actions.appendChild(mkBtn('+ From URL',  '', _promptImportUrl));
  actions.appendChild(mkBtn('+ From Gist', '', _promptImportGist));
  el.appendChild(actions);

  // Build list
  const builds = getCustomBuilds();
  if (!builds.length) {
    const empty = document.createElement('div');
    empty.className = 'ws-empty';
    empty.textContent = 'No custom builds yet. Create one or import from a file, URL, or Gist.';
    el.appendChild(empty);
  } else {
    const list = document.createElement('div');
    list.className = 'ws-build-list';

    builds.forEach(b => {
      const row = document.createElement('div');
      row.className = 'ws-build-row';

      // Info
      const info = document.createElement('div');
      info.className = 'ws-build-info';
      const nm = document.createElement('div');
      nm.className = 'ws-build-name';
      nm.textContent = b.name || 'Untitled';
      const meta = document.createElement('div');
      meta.className = 'ws-build-meta';
      const parts = [b._character === 'MC' ? 'MC' : b._character];
      if (b.theme) parts.push(b.theme);
      const src = b._source;
      if (src) parts.push(src.type === 'url' ? '↗ URL' : src.type === 'gist' ? '⬡ Gist' : '↑ File');
      meta.textContent = parts.join(' · ');
      info.appendChild(nm);
      info.appendChild(meta);

      if (b._updateAvailable) {
        const upd = document.createElement('div');
        upd.className = 'ws-update-badge';
        upd.textContent = '⚠ Update available';
        info.appendChild(upd);
      }
      row.appendChild(info);

      // Buttons
      const btns = document.createElement('div');
      btns.className = 'ws-build-btns';

      if (b._updateAvailable) {
        const u = document.createElement('button');
        u.className = 'ws-btn update';
        u.textContent = 'Update';
        u.addEventListener('click', () => _applyUrlUpdate(b._id));
        btns.appendChild(u);
      }

      const editBtn = document.createElement('button');
      editBtn.className = 'ws-btn';
      editBtn.textContent = 'Edit';
      editBtn.addEventListener('click', () => {
        _wsDraft = structuredClone(b);
        _wsExpandedLvl = null;
        _wsStep = 'setup';
        renderWorkshopSection();
      });
      btns.appendChild(editBtn);

      const exportBtn = document.createElement('button');
      exportBtn.className = 'ws-btn';
      exportBtn.textContent = 'Export';
      exportBtn.addEventListener('click', () => _exportBuild(b));
      btns.appendChild(exportBtn);

      const gistBtn = document.createElement('button');
      gistBtn.className = 'ws-btn';
      gistBtn.textContent = 'Gist';
      gistBtn.addEventListener('click', () => _pushToGist(b));
      btns.appendChild(gistBtn);

      const delBtn = document.createElement('button');
      delBtn.className = 'ws-btn danger';
      delBtn.textContent = 'Delete';
      delBtn.addEventListener('click', () => {
        if (!confirm(`Delete "${b.name}"?`)) return;
        _deleteBuild(b._id, b._character);
        renderWorkshopSection();
      });
      btns.appendChild(delBtn);

      row.appendChild(btns);
      list.appendChild(row);
    });
    el.appendChild(list);
  }

  // Gist PAT section
  const gistSec = document.createElement('div');
  gistSec.className = 'ws-gist-section';
  const gistH = document.createElement('div');
  gistH.className = 'ws-section-heading';
  gistH.textContent = 'GitHub Gist — Personal Access Token';
  const gistNote = document.createElement('div');
  gistNote.className = 'ws-gist-note';
  gistNote.innerHTML = 'Optional. Generate at <strong>github.com → Settings → Developer Settings → Tokens</strong> with <strong>gist</strong> scope. Stored locally, never sent anywhere except GitHub.';
  const patRow = document.createElement('div');
  patRow.className = 'ws-pat-row';
  const patInp = document.createElement('input');
  patInp.type = 'password';
  patInp.className = 'ws-pat-input';
  patInp.placeholder = 'ghp_…';
  patInp.value = getGistPat();
  patInp.autocomplete = 'off';
  const patSave = document.createElement('button');
  patSave.className = 'ws-btn';
  patSave.textContent = 'Save';
  patSave.addEventListener('click', () => {
    saveGistPat(patInp.value.trim());
    patSave.textContent = '✓ Saved';
    setTimeout(() => { patSave.textContent = 'Save'; }, 1500);
  });
  const patClear = document.createElement('button');
  patClear.className = 'ws-btn danger';
  patClear.textContent = 'Clear';
  patClear.addEventListener('click', () => { saveGistPat(''); patInp.value = ''; });
  patRow.appendChild(patInp);
  patRow.appendChild(patSave);
  patRow.appendChild(patClear);
  gistSec.appendChild(gistH);
  gistSec.appendChild(gistNote);
  gistSec.appendChild(patRow);
  el.appendChild(gistSec);
}

// ── Character select ──────────────────────────────────────────────────────────
function _renderCharSelect(el) {
  _wsBackBtn(el, 'manager', 'Workshop');

  const heading = document.createElement('div');
  heading.className = 'ws-step-heading';
  heading.textContent = 'Who is this build for?';
  el.appendChild(heading);

  const grid = document.createElement('div');
  grid.className = 'ws-char-grid';

  const mkChar = (label, char) => {
    const btn = document.createElement('div');
    btn.className = 'ws-char-btn';
    btn.textContent = label;
    btn.addEventListener('click', () => {
      _wsDraft = {
        _id: _genId(), _custom: true, _character: char,
        _modified: Date.now(),
        name: '', theme: char === 'MC' ? '' : char,
        origin: '', _homeworld: '', _origin: '',
        archetypes: {}, levels: {}, extras: { skills: '', gear: [] },
      };
      _wsStep = 'setup';
      renderWorkshopSection();
    });
    return btn;
  };

  grid.appendChild(mkChar('Player Character (MC)', 'MC'));
  COMPANION_ORDER.forEach(c => grid.appendChild(mkChar(c, c)));
  el.appendChild(grid);
}

// ── Build setup ───────────────────────────────────────────────────────────────
function _renderSetup(el) {
  _wsBackBtn(el, _wsDraft._character ? 'manager' : 'char-select', 'Workshop');

  const heading = document.createElement('div');
  heading.className = 'ws-step-heading';
  heading.textContent = _wsDraft._character === 'MC'
    ? 'MC Build — Setup' : `${_wsDraft._character} — Setup`;
  el.appendChild(heading);

  const form = document.createElement('div');
  form.className = 'ws-form';

  form.appendChild(_wsInput('Build name *', 'text', _wsDraft.name || '', v => { _wsDraft.name = v; }));

  if (_wsDraft._character === 'MC') {
    form.appendChild(_wsInput('Theme (e.g. Noble, Crimelord)', 'text', _wsDraft.theme || '', v => { _wsDraft.theme = v; }));

    const hwKeys = ['', ...Object.keys(DATA.definitions.homeworlds || {})];
    form.appendChild(_wsInput('Homeworld', 'select', _wsDraft._homeworld || '', v => {
      _wsDraft._homeworld = v;
      // Auto-build origin description
      _updateOriginText();
    }, { options: hwKeys }));

    const mcOrigins = ['', ...Object.entries(DATA.definitions.origins || {})
      .filter(([,o]) => o.mc).map(([k]) => k)];
    form.appendChild(_wsInput('Origin', 'select', _wsDraft._origin || '', v => {
      _wsDraft._origin = v;
      _updateOriginText();
    }, { options: mcOrigins }));

    // Auto-generated or manual origin description
    const origField = _wsInput('Origin description (auto-filled or override)', 'text', _wsDraft.origin || '', v => { _wsDraft.origin = v; });
    origField.dataset.wsOriginField = '1';
    form.appendChild(origField);
  }

  // Archetypes
  form.appendChild(_wsInput('Archetype — Tier 1', 'select', _wsDraft.archetypes?.t1 || '', v => {
    if (!_wsDraft.archetypes) _wsDraft.archetypes = {};
    _wsDraft.archetypes.t1 = v;
  }, { options: ['', ...WS_BASIC_ARCHETYPES] }));
  form.appendChild(_wsInput('Archetype — Tier 2', 'select', _wsDraft.archetypes?.t2 || '', v => {
    if (!_wsDraft.archetypes) _wsDraft.archetypes = {};
    _wsDraft.archetypes.t2 = v;
  }, { options: ['', ...WS_ADVANCED_ARCHETYPES] }));
  form.appendChild(_wsInput('Archetype — Tier 3 (optional)', 'select', _wsDraft.archetypes?.t3 || '', v => {
    if (!_wsDraft.archetypes) _wsDraft.archetypes = {};
    _wsDraft.archetypes.t3 = v || undefined;
  }, { options: ['', ...WS_ADVANCED_ARCHETYPES] }));

  form.appendChild(_wsInput('Recommended skills (comma-separated)', 'text',
    _wsDraft.extras?.skills || '', v => {
      if (!_wsDraft.extras) _wsDraft.extras = { gear: [] };
      _wsDraft.extras.skills = v;
  }));

  el.appendChild(form);

  const nextBtn = document.createElement('button');
  nextBtn.className = 'ws-next-btn';
  nextBtn.textContent = 'Continue → Level Picks';
  nextBtn.addEventListener('click', () => {
    if (!(_wsDraft.name || '').trim()) { alert('Build name required.'); return; }
    _wsExpandedLvl = null;
    _wsStep = 'levels';
    renderWorkshopSection();
  });
  el.appendChild(nextBtn);

  function _updateOriginText() {
    const hw = _wsDraft._homeworld || '';
    const orig = _wsDraft._origin || '';
    if (hw || orig) {
      const text = [hw, orig].filter(Boolean).join(' - ');
      _wsDraft.origin = text;
      const inp = form.querySelector('[data-ws-origin-field] input');
      if (inp) inp.value = text;
    }
  }
}

// ── Level pick editor ─────────────────────────────────────────────────────────
function _renderLevels(el) {
  _wsBackBtn(el, 'setup', _wsDraft.name || 'Setup');

  const heading = document.createElement('div');
  heading.className = 'ws-step-heading';
  heading.textContent = `${_wsDraft.name} — Level Picks`;
  el.appendChild(heading);

  const hint = document.createElement('div');
  hint.className = 'ws-hint';
  hint.textContent = 'Tap any level to set picks. Autocomplete shows all known talents, abilities, and characteristics.';
  el.appendChild(hint);

  // Datalist for autocomplete
  const dl = _buildPickDatalist();
  el.appendChild(dl);

  // Level list
  const list = document.createElement('div');
  list.className = 'ws-level-list';

  for (let n = 1; n <= MAX_LVL; n++) {
    const entry = (_wsDraft.levels && _wsDraft.levels[n]) || {};
    const isExpanded = _wsExpandedLvl === n;

    const row = document.createElement('div');
    row.className = 'ws-level-row' + (n === level ? ' is-current' : '') + (isExpanded ? ' expanded' : '');

    const lbl = document.createElement('div');
    lbl.className = 'ws-level-num';
    lbl.textContent = n;
    row.appendChild(lbl);

    if (isExpanded) {
      const inputs = document.createElement('div');
      inputs.className = 'ws-level-inputs';
      inputs.appendChild(_wsInput('Main pick', 'pick', entry.m || '', v => {
        if (!_wsDraft.levels) _wsDraft.levels = {};
        if (!_wsDraft.levels[n]) _wsDraft.levels[n] = {};
        _wsDraft.levels[n].m = v;
        if (!v && !_wsDraft.levels[n].e) delete _wsDraft.levels[n];
      }));
      inputs.appendChild(_wsInput('Extra pick', 'pick', entry.e || '', v => {
        if (!_wsDraft.levels) _wsDraft.levels = {};
        if (!_wsDraft.levels[n]) _wsDraft.levels[n] = {};
        _wsDraft.levels[n].e = v || undefined;
        if (!v && !_wsDraft.levels[n].m) delete _wsDraft.levels[n];
      }));
      row.appendChild(inputs);

      const done = document.createElement('button');
      done.className = 'ws-level-done';
      done.textContent = '✓';
      done.addEventListener('click', () => { _wsExpandedLvl = null; renderWorkshopSection(); });
      row.appendChild(done);
    } else {
      const summary = document.createElement('div');
      summary.className = 'ws-level-summary';
      const parts = [];
      if (entry.m) parts.push(entry.m);
      if (entry.e) parts.push('+ ' + entry.e);
      summary.textContent = parts.length ? parts.join(' · ') : '—';
      summary.style.color = parts.length ? '' : 'var(--ink-faint)';
      row.appendChild(summary);
      row.addEventListener('click', () => { _wsExpandedLvl = n; renderWorkshopSection(); });
    }

    list.appendChild(row);
  }
  el.appendChild(list);

  const saveBtn = document.createElement('button');
  saveBtn.className = 'ws-next-btn';
  saveBtn.textContent = '✓ Save Build';
  saveBtn.addEventListener('click', () => {
    _wsDraft._modified = Date.now();
    _saveDraft();
    _wsStep = 'manager';
    _wsExpandedLvl = null;
    _wsStatusMsg = { text: `"${_wsDraft.name}" saved.`, ok: true };
    renderWorkshopSection();
  });
  el.appendChild(saveBtn);
}

function _buildPickDatalist() {
  const dl = document.createElement('datalist');
  dl.id = 'ws-pick-dl';
  const seen = new Set();
  const add = v => { if (v && !seen.has(v)) { seen.add(v); const o = document.createElement('option'); o.value = v; dl.appendChild(o); } };

  ['Weapon Skill','Ballistic Skill','Strength','Toughness','Agility','Perception','Willpower','Fellowship','Intelligence',
   'AP +1','AP +2','Medicae','Commerce','Lore Imperium','Lore Xenos','Lore Warp','Persuasion','Coercion','Logic',
   'Tech-Use','Awareness','Athletics','Demolition','Carouse','Tracking','Navigate Warp'].forEach(add);
  Object.keys(DATA.definitions.talents  || {}).forEach(add);
  Object.keys(DATA.definitions.abilities || {}).forEach(add);
  return dl;
}

// ── Import preview ────────────────────────────────────────────────────────────
function _renderImportPreview(el) {
  _wsBackBtn(el, 'manager', 'Workshop');

  const heading = document.createElement('div');
  heading.className = 'ws-step-heading';
  heading.textContent = 'Import Preview';
  el.appendChild(heading);

  const b = _wsImportData;
  if (!b) { el.appendChild(Object.assign(document.createElement('div'), { className: 'ws-empty', textContent: 'No data.' })); return; }

  const preview = document.createElement('div');
  preview.className = 'ws-preview';

  [
    ['Name',        b.name || '—'],
    ['Character',   b._character || 'MC'],
    ['Theme',       b.theme || '—'],
    ['Origin',      b.origin || '—'],
    ['Archetypes',  [b.archetypes?.t1, b.archetypes?.t2, b.archetypes?.t3].filter(Boolean).join(' → ') || '—'],
    ['Levels set',  Object.keys(b.levels || {}).length],
    ['Source',      _wsImportSource?.url || _wsImportSource?.type || 'file'],
  ].forEach(([label, val]) => {
    const row = document.createElement('div');
    row.className = 'ws-preview-row';
    const l = document.createElement('span');
    l.className = 'ws-preview-label';
    l.textContent = label;
    const v = document.createElement('span');
    v.className = 'ws-preview-val';
    v.textContent = val;
    row.appendChild(l);
    row.appendChild(v);
    preview.appendChild(row);
  });
  el.appendChild(preview);

  const confirmBtn = document.createElement('button');
  confirmBtn.className = 'ws-next-btn';
  confirmBtn.textContent = '✓ Import Build';
  confirmBtn.addEventListener('click', () => {
    const build = { ..._wsImportData, _id: _genId(), _custom: true, _modified: Date.now() };
    if (_wsImportSource) build._source = _wsImportSource;
    const builds = getCustomBuilds();
    builds.push(build);
    saveCustomBuilds(builds);
    mergeCustomBuildsIntoData();
    _wsImportData = null; _wsImportSource = null;
    _wsStatusMsg = { text: `"${build.name}" imported.`, ok: true };
    _wsStep = 'manager';
    renderWorkshopSection();
  });
  el.appendChild(confirmBtn);
}

// ── Import: file ──────────────────────────────────────────────────────────────
function _importFromFile() {
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = '.json';
  inp.addEventListener('change', async () => {
    const file = inp.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const build = _parseImportText(text);
      if (!build) { alert('Could not parse build file. Must be a valid JSON build export.'); return; }
      _wsImportData   = build;
      _wsImportSource = { type: 'file', filename: file.name };
      _wsStep = 'import-preview';
      renderWorkshopSection();
    } catch (e) { alert('Error reading file: ' + e.message); }
  });
  inp.click();
}

// ── Import: URL ───────────────────────────────────────────────────────────────
function _promptImportUrl() {
  const url = prompt('Enter build URL (must return JSON):', '');
  if (!url) return;
  _fetchAndPreviewUrl(url.trim());
}

async function _fetchAndPreviewUrl(url) {
  try {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const text  = await resp.text();
    const etag  = resp.headers.get('ETag') || '';
    const build = _parseImportText(text);
    if (!build) { alert('Could not parse build at URL.'); return; }
    _wsImportData   = build;
    _wsImportSource = { type: 'url', url, etag, lastChecked: Date.now() };
    _wsStep = 'import-preview';
    renderWorkshopSection();
  } catch (e) { alert('Error fetching URL: ' + e.message); }
}

// ── Import: Gist ──────────────────────────────────────────────────────────────
function _promptImportGist() {
  const input = prompt('Enter Gist URL or ID:', '');
  if (!input) return;
  // Extract gist ID from URL or use raw
  const id = input.match(/gist\.github\.com\/(?:[^/]+\/)?([a-f0-9]+)/i)?.[1]
           || input.match(/gists\/([a-f0-9]+)/i)?.[1]
           || input.trim();
  _fetchGistAndPreview(id);
}

async function _fetchGistAndPreview(gistId) {
  try {
    const headers = {};
    const pat = getGistPat();
    if (pat) headers['Authorization'] = `token ${pat}`;
    const resp = await fetch(`https://api.github.com/gists/${gistId}`, { headers });
    if (!resp.ok) throw new Error(`GitHub API: HTTP ${resp.status}`);
    const data  = await resp.json();
    const files = Object.values(data.files || {});
    if (!files.length) throw new Error('Gist has no files');
    const content = files[0].content || await (await fetch(files[0].raw_url)).text();
    const build = _parseImportText(content);
    if (!build) { alert('Could not parse gist content as a build.'); return; }
    _wsImportData   = build;
    _wsImportSource = { type: 'gist', gistId: data.id, url: data.html_url, lastChecked: Date.now() };
    _wsStep = 'import-preview';
    renderWorkshopSection();
  } catch (e) { alert('Error loading gist: ' + e.message); }
}

// ── Export: file ──────────────────────────────────────────────────────────────
function _exportBuild(b) {
  const clean = Object.fromEntries(Object.entries(b).filter(([k]) => !k.startsWith('_')));
  clean._character = b._character; // keep this one
  const blob = new Blob([JSON.stringify(clean, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = (b.name || 'build').replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

// ── Export: Gist ──────────────────────────────────────────────────────────────
async function _pushToGist(b) {
  const pat = getGistPat();
  const clean = Object.fromEntries(Object.entries(b).filter(([k]) => !k.startsWith('_update')));
  clean._character = b._character;
  const body = {
    description: `RT Build: ${b.name}`,
    public: false,
    files: { 'rt-build.json': { content: JSON.stringify(clean, null, 2) } },
  };
  const headers = { 'Content-Type': 'application/json' };
  if (pat) headers['Authorization'] = `token ${pat}`;

  try {
    const existingGistId = b._source?.gistId;
    const url    = existingGistId && pat
      ? `https://api.github.com/gists/${existingGistId}`
      : 'https://api.github.com/gists';
    const method = existingGistId && pat ? 'PATCH' : 'POST';

    const resp = await fetch(url, { method, headers, body: JSON.stringify(body) });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}${pat ? '' : ' (no PAT — anonymous gists cannot be updated)'}`);
    const data = await resp.json();

    // Persist gist info on build
    const builds = getCustomBuilds();
    const idx = builds.findIndex(x => x._id === b._id);
    if (idx >= 0) {
      builds[idx]._source = { type: 'gist', gistId: data.id, url: data.html_url };
      saveCustomBuilds(builds);
    }

    _wsStatusMsg = { text: `Saved to Gist: ${data.html_url}`, ok: true };
    renderWorkshopSection();
    // Also copy URL to clipboard if possible
    if (navigator.clipboard) navigator.clipboard.writeText(data.html_url).catch(() => {});
  } catch (e) {
    alert('Gist error: ' + e.message);
  }
}

// ── Save / delete ─────────────────────────────────────────────────────────────
function _saveDraft() {
  const builds = getCustomBuilds();
  const idx = builds.findIndex(x => x._id === _wsDraft._id);
  if (idx >= 0) builds[idx] = _wsDraft;
  else           builds.push(_wsDraft);
  saveCustomBuilds(builds);
  mergeCustomBuildsIntoData();
}

function _deleteBuild(id, character) {
  saveCustomBuilds(getCustomBuilds().filter(x => !(x._id === id && x._character === character)));
  if (character === 'MC') {
    DATA.mc_builds = DATA.mc_builds.filter(x => x._id !== id);
  } else {
    const arr = DATA.companions[character];
    if (arr) DATA.companions[character] = arr.filter(x => x._id !== id);
  }
}

// ── URL sync (background) ─────────────────────────────────────────────────────
async function _checkUrlSources() {
  const builds  = getCustomBuilds();
  let changed   = false;
  for (const b of builds) {
    const src = b._source;
    if (!src || src.type !== 'url' || !src.url) continue;
    // Throttle: only check if >30 minutes since last check
    if (src.lastChecked && Date.now() - src.lastChecked < 30 * 60 * 1000) continue;
    try {
      const headers = src.etag ? { 'If-None-Match': src.etag } : {};
      const resp = await fetch(src.url, { headers });
      src.lastChecked = Date.now();
      if (resp.status === 304) { changed = true; continue; }
      if (!resp.ok) continue;
      const text     = await resp.text();
      const newEtag  = resp.headers.get('ETag') || '';
      const newBuild = _parseImportText(text);
      if (!newBuild) continue;
      // Compare content (ignore metadata)
      const snapshot = b => JSON.stringify({ name: b.name, levels: b.levels, archetypes: b.archetypes });
      if (snapshot(newBuild) !== snapshot(b)) {
        b._updateAvailable = true;
        b._pendingUpdate   = newBuild;
      }
      src.etag = newEtag;
      changed  = true;
    } catch (_) {}
  }
  if (changed) {
    saveCustomBuilds(builds);
    renderWorkshopSection();
  }
}

function _applyUrlUpdate(id) {
  const builds = getCustomBuilds();
  const b = builds.find(x => x._id === id);
  if (!b || !b._pendingUpdate) return;
  Object.assign(b, b._pendingUpdate);
  delete b._updateAvailable;
  delete b._pendingUpdate;
  b._modified = Date.now();
  saveCustomBuilds(builds);
  mergeCustomBuildsIntoData();
  _wsStatusMsg = { text: 'Build updated from source.', ok: true };
  renderWorkshopSection();
}

// ── Parse helper ──────────────────────────────────────────────────────────────
function _parseImportText(text) {
  try {
    const j = JSON.parse(text.trim());
    return _normaliseBuild(j);
  } catch (_) { return null; }
}

function _normaliseBuild(obj) {
  if (!obj || typeof obj !== 'object') return null;
  return {
    name:       obj.name       || 'Imported Build',
    _character: obj._character || 'MC',
    theme:      obj.theme      || '',
    origin:     obj.origin     || '',
    archetypes: obj.archetypes || {},
    levels:     obj.levels     || {},
    extras:     obj.extras     || { skills: '', gear: [] },
    dlc:        obj.dlc        || null,
  };
}

// ── UI helpers ────────────────────────────────────────────────────────────────
function _wsBackBtn(el, step, label) {
  const btn = document.createElement('button');
  btn.className = 'reference-back-btn';
  btn.textContent = '← ' + (label || 'Workshop');
  btn.addEventListener('click', () => { _wsStep = step; renderWorkshopSection(); });
  el.appendChild(btn);
}

function _wsInput(label, type, value, onChange, opts) {
  // opts: { options: [[val,lbl],...] } for select
  //       { listId: 'id' } for pick (datalist)
  //       nothing extra for text/password
  const wrap = document.createElement('div');
  wrap.className = type === 'pick' ? 'ws-pick-wrap' : 'ws-field';
  const lbl = document.createElement('label');
  lbl.className = 'ws-field-label';
  lbl.textContent = label;
  wrap.appendChild(lbl);

  if (type === 'select') {
    const sel = document.createElement('select');
    sel.className = 'ws-field-select';
    (opts && opts.options || []).forEach(opt => {
      const o = document.createElement('option');
      o.value = opt;
      o.textContent = opt || '— choose —';
      if (opt === value) o.selected = true;
      sel.appendChild(o);
    });
    sel.addEventListener('change', () => onChange(sel.value));
    wrap.appendChild(sel);
  } else {
    const inp = document.createElement('input');
    inp.type = type === 'pick' ? 'text' : type;
    inp.className = 'ws-field-input';
    inp.value = value;
    if (type === 'pick') {
      inp.setAttribute('list', 'ws-pick-dl');
      inp.addEventListener('change', () => onChange(inp.value));
      inp.addEventListener('blur',   () => onChange(inp.value));
    } else {
      inp.addEventListener('input', () => onChange(inp.value));
    }
    wrap.appendChild(inp);
  }

  return wrap;
}
