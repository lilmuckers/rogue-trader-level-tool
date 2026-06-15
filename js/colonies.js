// ============= HOLDINGS: COLONIES + VOIDSHIP =============

// ── Persistence ────────────────────────────────────────────────────────────────
// KEY_ constants are in store.js

function getColonyDone(colonyName) {
  return (Store.get(KEY_COLONY_DONE) || {})[colonyName] || {};
}
function toggleColonyProject(colonyName, projectName) {
  Store.mutate(KEY_COLONY_DONE, all => {
    if (!all[colonyName]) all[colonyName] = {};
    if (all[colonyName][projectName]) delete all[colonyName][projectName];
    else all[colonyName][projectName] = true;
  });
}
function getColonyLevel(colonyName) {
  return (Store.get(KEY_COLONY_LEVEL) || {})[colonyName] || 1;
}
function setColonyLevel(colonyName, newLevel) {
  Store.mutate(KEY_COLONY_LEVEL, all => {
    all[colonyName] = Math.max(1, Math.min(5, newLevel));
  });
}

// Voidship: stores { rankIndex: { optionName: true } } — both options per rank can be taken
function getVoidshipChoices() { return Store.get(KEY_VOIDSHIP_DONE) || {}; }
function isVoidshipOptionChosen(rankIndex, optionName) {
  const rank = getVoidshipChoices()[rankIndex];
  return !!(rank && rank[optionName]);
}
function toggleVoidshipOption(rankIndex, optionName) {
  Store.mutate(KEY_VOIDSHIP_DONE, all => {
    if (!all[rankIndex]) all[rankIndex] = {};
    if (all[rankIndex][optionName]) delete all[rankIndex][optionName];
    else all[rankIndex][optionName] = true;
    if (!Object.keys(all[rankIndex]).length) delete all[rankIndex];
  });
}

function getVoidshipName(defaultName) { return Store.get(KEY_VOIDSHIP_NAME) || defaultName || 'Righteous Fury'; }
function setVoidshipName(n) { n.trim() ? Store.set(KEY_VOIDSHIP_NAME, n.trim()) : Store.remove(KEY_VOIDSHIP_NAME); }

function getHoldingsTab() { return Store.get(KEY_HOLDINGS_TAB) || 'colonies'; }
function setHoldingsTab(t) { Store.set(KEY_HOLDINGS_TAB, t); }

let _selectedColony = 0;

// ── Main render ────────────────────────────────────────────────────────────────
function renderColonySection() {
  const el = $('colony-content');
  el.innerHTML = '';

  const tabBar = _makeTabBar(
    [{ id: 'colonies', label: 'Colonies' }, { id: 'voidship', label: 'Voidship' }],
    getHoldingsTab(),
    id => { setHoldingsTab(id); _pushHash('colony', id); renderColonySection(); },
    'holdings-tab-bar', 'holdings-tab-btn'
  );
  el.appendChild(tabBar);

  if (getHoldingsTab() === 'colonies') {
    renderColoniesTab(el);
  } else {
    renderVoidshipTab(el);
  }
}

// ── Colonies tab ───────────────────────────────────────────────────────────────
function renderColoniesTab(el) {
  if (!DATA.colonies || !DATA.colonies.length) {
    el.appendChild(_makeEmptyState('No colony data available.'));
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
    el.appendChild(_makeEmptyState('No voidship data available.'));
    return;
  }

  const ship = ships[0];
  const ranks = ship.ranks || [];
  const totalOptions = ranks.reduce((sum, r) => sum + (r.options || []).length, 0);
  const chosenCount = ranks.reduce((sum, r, i) =>
    sum + (r.options || []).filter(opt => isVoidshipOptionChosen(i, opt.name)).length, 0);
  const shipName = getVoidshipName(ship.name);

  // Editable ship name + progress
  const nameRow = document.createElement('div');
  nameRow.className = 'voidship-name-row';

  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.className = 'voidship-name-input';
  nameInput.value = shipName;
  nameInput.maxLength = 48;
  nameInput.placeholder = ship.name;
  nameInput.setAttribute('autocorrect', 'off');
  nameInput.setAttribute('spellcheck', 'false');
  nameInput.addEventListener('change', () => { setVoidshipName(nameInput.value); });
  nameInput.addEventListener('blur',   () => { setVoidshipName(nameInput.value); });

  const progress = document.createElement('span');
  progress.className = 'voidship-progress';
  progress.textContent = `Upgrades ${chosenCount} / ${totalOptions}`;

  nameRow.append(nameInput, progress);
  el.appendChild(nameRow);

  ranks.forEach((rank, rankIndex) => {
    const options = rank.options || [];
    const anyChosen = options.some(opt => isVoidshipOptionChosen(rankIndex, opt.name));
    const allChosen = options.length > 0 && options.every(opt => isVoidshipOptionChosen(rankIndex, opt.name));

    const section = document.createElement('div');
    section.className = 'colony-level-section';

    const heading = document.createElement('div');
    heading.className = 'colony-level-heading' +
      (allChosen ? ' is-past' : anyChosen ? ' is-current' : ' is-future');
    heading.textContent = `Rank ${rank.rank}`;
    section.appendChild(heading);

    // Two-option pick row — both options can be taken independently
    const pickRow = document.createElement('div');
    pickRow.className = 'voidship-pick-row';

    options.forEach(opt => {
      const isChosen = isVoidshipOptionChosen(rankIndex, opt.name);

      const card = document.createElement('div');
      card.className = 'voidship-option' + (isChosen ? ' is-chosen' : '');

      const typeEl = document.createElement('div');
      typeEl.className = 'voidship-option-type';
      typeEl.textContent = opt.type || '';

      const nameEl = document.createElement('div');
      nameEl.className = 'voidship-option-name';
      nameEl.textContent = opt.name;

      card.append(typeEl, nameEl);

      // Toggle this option independently; open detail sheet via the info button
      card.addEventListener('click', () => {
        toggleVoidshipOption(rankIndex, opt.name);
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
