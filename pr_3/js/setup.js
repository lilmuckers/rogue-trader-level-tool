// ============= SETUP =============
function renderSetup() {
  // MC name
  const nameInput = $('mc-name-input');
  nameInput.value = getMCName();

  // MC theme/build
  const themeSel = $('mc-theme-select');
  themeSel.innerHTML = '';
  const themes = getMCThemes();
  const curTheme = (config && config.mc) ? config.mc.theme : 'Commissar';
  themes.forEach(t => {
    const o = document.createElement('option');
    o.value = t; o.textContent = t;
    if (t === curTheme) o.selected = true;
    themeSel.appendChild(o);
  });
  populateBuildSelect(themeSel.value);
  themeSel.onchange = () => populateBuildSelect(themeSel.value);

  // Companion list (read-only summary in setup — managed via + button on main screen)
  const cWrap = $('companion-selects');
  cWrap.innerHTML = '';
  const roster = getRoster();
  roster.forEach(({ char: charName, build: buildName, joinLevel }) => {
    const row = document.createElement('div');
    row.className = 'setup-row companion-setup-row';
    row.style.cssText = 'display:flex;align-items:center;gap:8px;';
    const info = document.createElement('span');
    info.className = 'setup-label';
    info.style.flex = '1';
    info.textContent = `${charName} · ${buildName} · Lv ${joinLevel}`;
    const removeBtn = document.createElement('button');
    removeBtn.className = 'companion-remove-btn';
    removeBtn.textContent = '✕';
    removeBtn.title = `Remove ${charName}`;
    removeBtn.addEventListener('click', () => {
      removeFromRoster(charName);
      removeFromParty(charName);
      renderSetup();
      renderTracker();
    });
    row.append(info, removeBtn);
    cWrap.appendChild(row);
  });

  $('cancel-setup-btn').classList.toggle('hidden', !config);
  $('reset-btn').classList.toggle('hidden', !config);
}

function populateBuildSelect(theme) {
  const buildSel = $('mc-build-select');
  buildSel.innerHTML = '';
  const builds = getMCBuilds(theme);
  let curIdx = 0;
  if (config && config.mc && config.mc.theme === theme) curIdx = config.mc.buildIndex;
  else if (theme === 'Commissar') {
    const tc = builds.findIndex(b => /taking command/i.test(b.name));
    if (tc >= 0) curIdx = tc;
  }
  builds.forEach((b, i) => {
    const o = document.createElement('option');
    o.value = i; o.textContent = b.name;
    if (i === curIdx) o.selected = true;
    buildSel.appendChild(o);
  });
}
