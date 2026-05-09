// ============= COLONY PROJECTS =============

const KEY_COLONY_DONE  = 'rt.colony-done.v1';
const KEY_COLONY_LEVEL = 'rt.colony-level.v1';

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

let _selectedColony = 0;

function renderColonySection() {
  const el = $('colony-content');
  el.innerHTML = '';
  if (!DATA.colonies || !DATA.colonies.length) {
    el.textContent = 'No colony data available.';
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
          // Open modal sheet with project details
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
