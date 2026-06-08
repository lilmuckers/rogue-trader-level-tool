// ============= HOLDINGS: COLONIES + VOIDSHIP =============

// ── Persistence ────────────────────────────────────────────────────────────────
const KEY_COLONY_DONE    = 'rt.colony-done.v1';
const KEY_COLONY_LEVEL   = 'rt.colony-level.v1';
const KEY_VOIDSHIP_DONE  = 'rt.voidship-done.v1';
const KEY_HOLDINGS_TAB   = 'rt.holdings-tab.v1';

function getColonyDone(colonyName) {
  return (Store.get(KEY_COLONY_DONE) || {})[colonyName] || {};
}
function toggleColonyProject(colonyName, projectName) {
  const all = Store.get(KEY_COLONY_DONE) || {};
  if (!all[colonyName]) all[colonyName] = {};
  if (all[colonyName][projectName]) delete all[colonyName][projectName];
  else all[colonyName][projectName] = true;
  Store.set(KEY_COLONY_DONE, all);
}
function getColonyLevel(colonyName) {
  return (Store.get(KEY_COLONY_LEVEL) || {})[colonyName] || 1;
}
function setColonyLevel(colonyName, newLevel) {
  const all = Store.get(KEY_COLONY_LEVEL) || {};
  all[colonyName] = Math.max(1, Math.min(5, newLevel));
  Store.set(KEY_COLONY_LEVEL, all);
}

// Voidship: stores { rankIndex: chosenOptionName | null }
function getVoidshipChoices() { return Store.get(KEY_VOIDSHIP_DONE) || {}; }
function setVoidshipChoice(rankIndex, optionName) {
  const all = getVoidshipChoices();
  if (all[rankIndex] === optionName) delete all[rankIndex]; // toggle off
  else all[rankIndex] = optionName;
  Store.set(KEY_VOIDSHIP_DONE, all);
}
function getVoidshipChoice(rankIndex) {
  return getVoidshipChoices()[rankIndex] || null;
}

function getHoldingsTab() { return Store.get(KEY_HOLDINGS_TAB) || 'colonies'; }
function setHoldingsTab(t) { Store.set(KEY_HOLDINGS_TAB, t); }

let _selectedColony = 0;

// ── Main render ────────────────────────────────────────────────────────────────
function renderColonySection() {
  const el = $('colony-content');
  el.innerHTML = '';

  // Tab bar
  const tabBar = document.createElement('div');
  tabBar.className = 'holdings-tab-bar';
  const activeTab = getHoldingsTab();

  const tabs = [
    { id: 'colonies', label: 'Colonies' },
    { id: 'voidship', label: 'Voidship' },
  ];
  tabs.forEach(({ id, label }) => {
    const btn = document.createElement('button');
    btn.className = 'holdings-tab-btn' + (activeTab === id ? ' active' : '');
    btn.textContent = label;
    btn.addEventListener('click', () => {
      setHoldingsTab(id);
      renderColonySection();
    });
    tabBar.appendChild(btn);
  });
  el.appendChild(tabBar);

  if (activeTab === 'colonies') {
    renderColoniesTab(el);
  } else {
    renderVoidshipTab(el);
  }
}

// ── Colonies tab ───────────────────────────────────────────────────────────────
function renderColoniesTab(el) {
  if (!DATA.colonies || !DATA.colonies.length) {
    const em = document.createElement('div');
    em.className = 'gb-empty';
    em.textContent = 'No colony data available.';
    el.appendChild(em);
    return;
  }
  const colony = DATA.colonies[_selectedColony];
  const colonyLevel = getColonyLevel(colony.name);
  const done = getColonyDone(colony.name);

  // Colony selector + level stepper
  const selectorWrap = document.createElement('div');
  selectorWrap.className = 'colony-selector-wrap';

  const sel = document.createElement('select');
  sel.className = 'colony-select';
  DATA.colonies.forEach((c, i) => {
    const o = document.createElement('option');
    o.value = i; o.textContent = c.name; o.selected = i === _selectedColony;
    sel.appendChild(o);
  });
  sel.addEventListener('change', () => { _selectedColony = parseInt(sel.value, 10); renderColonySection(); });
  selectorWrap.appendChild(sel);

  const levelWrap = document.createElement('div');
  levelWrap.className = 'colony-level-wrap';
  const levelLabel = document.createElement('span');
  levelLabel.className = 'colony-level-label';
  levelLabel.textContent = 'Level';
  const btnDown = document.createElement('button');
  btnDown.className = 'colony-level-btn'; btnDown.textContent = '−';
  btnDown.addEventListener('click', () => { setColonyLevel(colony.name, colonyLevel - 1); renderColonySection(); });
  const levelNum = document.createElement('span');
  levelNum.className = 'colony-level-num'; levelNum.textContent = colonyLevel;
  const btnUp = document.createElement('button');
  btnUp.className = 'colony-level-btn'; btnUp.textContent = '+';
  btnUp.addEventListener('click', () => { setColonyLevel(colony.name, colonyLevel + 1); renderColonySection(); });
  levelWrap.append(levelLabel, btnDown, levelNum, btnUp);
  selectorWrap.appendChild(levelWrap);
  el.appendChild(selectorWrap);

  // Project levels
  const levels = colony.levels || {};
  for (const lvlStr of Object.keys(levels).sort((a, b) => a - b)) {
    const lvl = parseInt(lvlStr, 10);
    const projects = levels[lvlStr];
    const isCurrent = lvl === colonyLevel;
    const isFuture  = lvl > colonyLevel;
    const isPast    = lvl < colonyLevel;

    const section = document.createElement('div');
    section.className = 'colony-level-section';

    const heading = document.createElement('div');
    heading.className = 'colony-level-heading' +
      (isCurrent ? ' is-current' : isPast ? ' is-past' : ' is-future');
    heading.textContent = `Level ${lvl}`;
    section.appendChild(heading);

    for (const project of (projects || [])) {
      const isDone = !!done[project.name];
      const card = document.createElement('div');
      card.className = 'colony-project' +
        (isDone ? ' is-done' : '') +
        (isFuture ? ' is-future' : '') +
        (isPast && !isDone ? ' is-past-uncomplete' : '');

      const header = document.createElement('div');
      header.className = 'colony-project-header';
      const check = document.createElement('div');
      check.className = 'colony-project-check';
      check.textContent = isDone ? '✓' : '';
      const nameEl = document.createElement('div');
      nameEl.className = 'colony-project-name';
      nameEl.textContent = project.name;
      header.append(check, nameEl);
      card.appendChild(header);

      if (!isFuture) {
        check.addEventListener('click', (e) => {
          e.stopPropagation();
          toggleColonyProject(colony.name, project.name);
          renderColonySection();
        });
        nameEl.style.cursor = 'pointer';
        card.addEventListener('click', (e) => {
          if (check.contains(e.target)) return;
          openSheet(project.name, () => {
            const wrap = document.createElement('div');
            wrap.className = 'colony-project-detail-sheet';
            if (project.cost && project.cost !== 'None') {
              const row = document.createElement('div');
              row.className = 'colony-project-row';
              row.innerHTML = `<strong>Cost:</strong> ${project.cost}`;
              wrap.appendChild(row);
            }
            if (project.benefit) {
              const row = document.createElement('div');
              row.className = 'colony-project-row';
              row.innerHTML = `<strong>Reward:</strong> ${project.benefit}`;
              wrap.appendChild(row);
            }
            if (!project.cost && !project.benefit) {
              const row = document.createElement('div');
              row.className = 'colony-project-row';
              row.textContent = 'No details available.';
              wrap.appendChild(row);
            }
            return wrap;
          });
        });
      }
      section.appendChild(card);
    }
    el.appendChild(section);
  }
}

// ── Voidship tab ───────────────────────────────────────────────────────────────
function renderVoidshipTab(el) {
  const ships = DATA.voidshipUpgrades || [];
  if (!ships.length) {
    const em = document.createElement('div');
    em.className = 'gb-empty';
    em.textContent = 'No voidship data available.';
    el.appendChild(em);
    return;
  }

  const ship = ships[0];
  const ranks = ship.ranks || [];
  const chosenCount = ranks.filter((_, i) => getVoidshipChoice(i) !== null).length;

  // Progress summary
  const summary = document.createElement('div');
  summary.className = 'voidship-summary';
  summary.textContent = `${ship.name} · Rank ${chosenCount} / ${ranks.length}`;
  el.appendChild(summary);

  ranks.forEach((rank, rankIndex) => {
    const chosen = getVoidshipChoice(rankIndex);

    const section = document.createElement('div');
    section.className = 'colony-level-section';

    const heading = document.createElement('div');
    heading.className = 'colony-level-heading' +
      (chosen ? ' is-past' : rankIndex === chosenCount ? ' is-current' : ' is-future');
    heading.textContent = `Rank ${rank.rank}`;
    section.appendChild(heading);

    // Two-option pick row
    const pickRow = document.createElement('div');
    pickRow.className = 'voidship-pick-row';

    (rank.options || []).forEach(opt => {
      const isChosen = chosen === opt.name;
      const isOtherChosen = chosen && chosen !== opt.name;

      const card = document.createElement('div');
      card.className = 'voidship-option' +
        (isChosen ? ' is-chosen' : '') +
        (isOtherChosen ? ' is-unchosen' : '');

      const typeEl = document.createElement('div');
      typeEl.className = 'voidship-option-type';
      typeEl.textContent = opt.type || '';

      const nameEl = document.createElement('div');
      nameEl.className = 'voidship-option-name';
      nameEl.textContent = opt.name;

      card.append(typeEl, nameEl);

      // Toggle choice on tap; open detail sheet on long-press / second tap
      card.addEventListener('click', () => {
        setVoidshipChoice(rankIndex, opt.name);
        renderColonySection();
      });

      // Detail: open sheet on name long-press via a dedicated info button
      const infoBtn = document.createElement('button');
      infoBtn.className = 'voidship-option-info';
      infoBtn.textContent = 'ⓘ';
      infoBtn.title = 'Details';
      infoBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openSheet(opt.name, () => {
          const wrap = document.createElement('div');
          wrap.className = 'colony-project-detail-sheet';
          const typeRow = document.createElement('div');
          typeRow.className = 'colony-project-row';
          typeRow.innerHTML = `<strong>Type:</strong> ${opt.type || '—'}`;
          wrap.appendChild(typeRow);
          if (opt.description) {
            const descRow = document.createElement('div');
            descRow.className = 'colony-project-row';
            descRow.innerHTML = `<strong>Effect:</strong> ${opt.description}`;
            wrap.appendChild(descRow);
          }
          return wrap;
        });
      });
      card.appendChild(infoBtn);

      pickRow.appendChild(card);
    });

    section.appendChild(pickRow);
    el.appendChild(section);
  });
}
