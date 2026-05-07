// ============= RENDER TRACKER =============
function renderTracker() {
  $('lvl-num').textContent = level;
  $('lvl-down').disabled = level <= MIN_LVL;
  $('lvl-up').disabled = level >= MAX_LVL;

  const rosterEl = $('roster');
  rosterEl.innerHTML = '';

  // MC
  const mc = getCurrentMC();
  if (mc) {
    rosterEl.appendChild(charCard({
      mc: true, key: 'Rogue Trader', displayName: getMCDisplayName(),
      buildName: mc.name, arch: detectArchetype(mc.origin) || '—',
      pick: pickAt(mc, level), available: true, build: mc,
    }));
  }

  const rosterData = getRoster();
  const party = getParty();

  // Party section
  const partyMembers = party.filter(n => rosterData.some(e => e.char === n));
  if (partyMembers.length) {
    const ph = document.createElement('div');
    ph.className = 'roster-heading';
    ph.textContent = '◆ Party ◆';
    rosterEl.appendChild(ph);
    partyMembers.forEach((charName, idx) => {
      const entry = rosterData.find(e => e.char === charName);
      if (!entry) return;
      rosterEl.appendChild(buildCompanionCard(entry, idx, 'party'));
    });
  }

  // Retinue section (non-party roster members)
  const retinue = rosterData.filter(e => !party.includes(e.char));
  const heading = document.createElement('div');
  heading.className = 'roster-heading';
  heading.textContent = '◆ Retinue ◆';
  rosterEl.appendChild(heading);

  retinue.forEach((entry, idx) => {
    rosterEl.appendChild(buildCompanionCard(entry, idx, 'retinue'));
  });

  // Add companion button
  const addBtn = document.createElement('button');
  addBtn.className = 'roster-add-btn';
  addBtn.textContent = '＋ Add Companion';
  addBtn.addEventListener('click', openAddCompanionSheet);
  rosterEl.appendChild(addBtn);
}

function buildCompanionCard(entry, idx, section) {
  const { char: charName, build: buildName, joinLevel } = entry;
  const variants = DATA.companions[charName];
  const variant = variants ? (variants.find(v => v.name === buildName) || variants[0]) : null;
  if (!variant) return document.createTextNode('');
  const available = level >= joinLevel;

  const wrap = document.createElement('div');
  wrap.className = 'roster-card-wrap';
  wrap.dataset.char = charName;
  wrap.dataset.section = section;

  // Drag handle
  const handle = document.createElement('div');
  handle.className = 'drag-handle';
  handle.innerHTML = '⠿';
  handle.setAttribute('aria-label', 'Drag to reorder');
  wrap.appendChild(handle);

  const card = charCard({
    mc: false, key: charName, displayName: charName,
    buildName: variant.name, arch: COMPANION_ARCH[charName] || '',
    pick: available ? pickAt(variant, level) : null,
    available, joinLevel, build: variant,
    isCompanion: true,
  });
  wrap.appendChild(card);

  // Attach drag-to-reorder on handle
  attachDragReorder(handle, wrap, section);
  // Swipe-left to delete (only when not in reorder mode)
  attachSwipeDelete(card, charName, wrap);
  return wrap;
}

function attachSwipeDelete(card, charName, wrap) {
  const DELETE_THRESHOLD = 100; // px to trigger delete
  let startX = 0, startY = 0, dx = 0, intentDecided = false, active = false;

  // Delete button revealed behind card
  const deleteBg = document.createElement('div');
  deleteBg.className = 'swipe-delete-bg';
  deleteBg.textContent = 'Remove';
  wrap.insertBefore(deleteBg, card); // behind card (card has z-index:1)

  const reset = (animate = true) => {
    if (animate) card.style.transition = 'transform 0.2s ease';
    card.style.transform = '';
    deleteBg.classList.remove('visible');
    setTimeout(() => { card.style.transition = ''; }, 220);
    active = false; intentDecided = false; dx = 0;
  };

  const doDelete = () => {
    card.style.transition = 'transform 0.2s ease, opacity 0.2s ease';
    card.style.transform = 'translateX(-100%)';
    card.style.opacity = '0';
    setTimeout(() => {
      removeFromRoster(charName);
      removeFromParty(charName);
      renderTracker();
    }, 200);
  };

  card.addEventListener('touchstart', (e) => {
    if (_reorderMode) return;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    dx = 0; intentDecided = false; active = false;
  }, { passive: true });

  card.addEventListener('touchmove', (e) => {
    if (_reorderMode) return;
    dx = e.touches[0].clientX - startX;
    const dy = e.touches[0].clientY - startY;
    if (!intentDecided) {
      if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
      if (Math.abs(dy) >= Math.abs(dx)) { intentDecided = true; return; } // vertical — ignore
      if (dx > 0) { intentDecided = true; return; } // swipe right — ignore
      intentDecided = true;
      active = true;
    }
    if (!active) return;
    card.style.transition = 'none';
    card.style.transform = `translateX(${Math.min(0, dx)}px)`;
    deleteBg.classList.toggle('visible', dx < -20);
  }, { passive: true });

  card.addEventListener('touchend', () => {
    if (!active) return;
    if (dx < -DELETE_THRESHOLD) {
      doDelete();
    } else {
      reset();
    }
  });

  card.addEventListener('touchcancel', () => reset(false));
  deleteBg.addEventListener('click', doDelete);
}

// ============= DRAG REORDER =============
function attachDragReorder(handle, wrap, section) {
  let startX = 0, startY = 0, startIdx = 0;
  let ghost = null, dragging = false, intentDecided = false;

  const cleanup = () => {
    if (ghost) { ghost.remove(); ghost = null; }
    wrap.classList.remove('dragging');
    $('roster').querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    dragging = false;
    intentDecided = false;
  };

  const startDrag = () => {
    dragging = true;
    wrap.classList.add('dragging');
    ghost = wrap.cloneNode(true);
    ghost.classList.add('drag-ghost');
    ghost.style.top = wrap.getBoundingClientRect().top + 'px';
    document.body.appendChild(ghost);
    const siblings = Array.from(wrap.parentElement.querySelectorAll(`.roster-card-wrap[data-section="${section}"]`));
    startIdx = siblings.indexOf(wrap);
  };

  handle.addEventListener('touchstart', (e) => {
    if (!_reorderMode) return; // only active in reorder mode
    e.preventDefault();
    e.stopPropagation();
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    intentDecided = false;
    dragging = false;
  }, { passive: false });

  handle.addEventListener('touchmove', (e) => {
    const dx = Math.abs(e.touches[0].clientX - startX);
    const dy = e.touches[0].clientY - startY;
    const adx = dx, ady = Math.abs(dy);

    // Decide intent on first significant movement
    if (!intentDecided && (adx > 5 || ady > 5)) {
      intentDecided = true;
      if (adx > ady) { cleanup(); return; } // horizontal swipe — abort
      startDrag();
    }
    if (!dragging) return;
    e.preventDefault();

    ghost.style.transform = `translateY(${dy}px)`;

    const rEl = $('roster');
    const siblings = Array.from(rEl.querySelectorAll(`.roster-card-wrap[data-section="${section}"]`));
    const fingerY = e.touches[0].clientY;
    let targetIdx = startIdx;
    siblings.forEach((el, i) => {
      if (el === wrap) return;
      const rect = el.getBoundingClientRect();
      if (fingerY > rect.top + rect.height / 2) targetIdx = i;
    });
    siblings.forEach(el => el.classList.remove('drag-over'));
    if (siblings[targetIdx] && siblings[targetIdx] !== wrap) {
      siblings[targetIdx].classList.add('drag-over');
    }
  }, { passive: false });

  handle.addEventListener('touchend', (e) => {
    if (!dragging) { cleanup(); return; }

    const rEl = $('roster');
    const siblings = Array.from(rEl.querySelectorAll(`.roster-card-wrap[data-section="${section}"]`));
    const fingerY = e.changedTouches[0].clientY;
    let targetIdx = startIdx;
    siblings.forEach((el, i) => {
      if (el === wrap) return;
      const rect = el.getBoundingClientRect();
      if (fingerY > rect.top + rect.height / 2) targetIdx = i;
    });

    cleanup();
    if (targetIdx === startIdx) return;

    if (section === 'party') {
      const p = getParty();
      const partyVisible = p.filter(n => getRoster().some(e => e.char === n));
      const moved = partyVisible.splice(startIdx, 1)[0];
      if (!moved) return;
      partyVisible.splice(targetIdx, 0, moved);
      setParty(partyVisible);
    } else {
      const r = getRoster();
      const retinue = r.filter(e => !getParty().includes(e.char));
      const moved = retinue.splice(startIdx, 1)[0];
      if (!moved) return; // safety: invalid index, abort
      retinue.splice(targetIdx, 0, moved);
      const partyEntries = r.filter(e => getParty().includes(e.char));
      setRoster([...partyEntries, ...retinue].filter(Boolean));
    }
    renderTracker();
  });

  handle.addEventListener('touchcancel', cleanup);
}

// ============= ADD COMPANION SHEET =============
function openAddCompanionSheet() {
  openSheet('Add Companion', () => buildAddCompanionContent());
}

function buildAddCompanionContent() {
  const wrap = document.createElement('div');
  wrap.className = 'add-comp-form';

  const added = new Set(getRoster().map(e => e.char));
  const available = COMPANION_ORDER.filter(n => !added.has(n) && DATA.companions[n]);

  if (!available.length) {
    const msg = document.createElement('div');
    msg.style.cssText = 'color:var(--ink-dim);padding:12px 0;';
    msg.textContent = 'All companions already added.';
    wrap.appendChild(msg);
    return wrap;
  }

  // ── Character dropdown ──
  const charLabel = document.createElement('div');
  charLabel.className = 'add-comp-section-label';
  charLabel.textContent = 'Character';
  const charSel = document.createElement('select');
  charSel.className = 'setup-select';
  available.forEach(charName => {
    const o = document.createElement('option');
    o.value = charName;
    o.textContent = `${charName}  ·  ${COMPANION_ARCH[charName] || ''}`;
    charSel.appendChild(o);
  });

  // ── Build dropdown ──
  const buildLabel = document.createElement('div');
  buildLabel.className = 'add-comp-section-label';
  buildLabel.textContent = 'Build';
  const buildSel = document.createElement('select');
  buildSel.className = 'setup-select';

  // ── Join level ──
  const joinLabel = document.createElement('div');
  joinLabel.className = 'add-comp-section-label';
  joinLabel.textContent = 'Joins at level';
  const joinInput = document.createElement('input');
  joinInput.type = 'number'; joinInput.min = 1; joinInput.max = 55;
  joinInput.className = 'add-comp-join-input';
  joinInput.style.userSelect = 'text'; joinInput.style.webkitUserSelect = 'text';

  // ── Buttons ──
  const partyFull = getParty().length >= MAX_PARTY;
  const btnRow = document.createElement('div');
  btnRow.className = 'add-comp-btn-row';

  const rosterBtn = document.createElement('button');
  rosterBtn.className = 'add-comp-confirm-btn';
  rosterBtn.textContent = 'Add to Roster';

  const partyBtn = document.createElement('button');
  partyBtn.className = 'add-comp-confirm-btn add-comp-party-btn';
  partyBtn.textContent = partyFull ? 'Party Full' : 'Add to Party';
  partyBtn.disabled = partyFull;

  btnRow.append(rosterBtn, partyBtn);

  // Update builds + join level when character changes
  const updateForChar = () => {
    const charName = charSel.value;
    const variants = DATA.companions[charName] || [];
    buildSel.innerHTML = '';
    variants.forEach((v, i) => {
      const o = document.createElement('option');
      o.value = i; o.textContent = v.name;
      buildSel.appendChild(o);
    });
    buildSel.disabled = variants.length <= 1;
    joinInput.value = DEFAULT_JOIN_LEVELS[charName] || 1;
  };
  charSel.addEventListener('change', updateForChar);
  updateForChar(); // init

  const getEntry = () => {
    const charName = charSel.value;
    const variants = DATA.companions[charName] || [];
    const build = (variants[parseInt(buildSel.value, 10)] || variants[0])?.name || '';
    const joinLevel = Math.max(1, Math.min(55, parseInt(joinInput.value, 10) || 1));
    return { char: charName, build, joinLevel };
  };

  rosterBtn.addEventListener('click', () => {
    addToRoster(getEntry());
    closeSheet();
    renderTracker();
  });

  partyBtn.addEventListener('click', () => {
    const entry = getEntry();
    addToRoster(entry);
    addToParty(entry.char);
    closeSheet();
    renderTracker();
  });

  wrap.append(charLabel, charSel, buildLabel, buildSel, joinLabel, joinInput, btnRow);
  return wrap;
}

function makePortrait(key) {
  const wrap = document.createElement('div');
  wrap.className = 'portrait';
  const url = PORTRAITS[key];
  if (url) {
    const img = document.createElement('img');
    img.alt = key; img.loading = 'lazy';
    img.referrerPolicy = 'no-referrer';
    img.onerror = () => {
      wrap.innerHTML = '';
      const fb = document.createElement('div');
      fb.className = 'portrait-fallback';
      fb.textContent = initialsFor(key);
      wrap.appendChild(fb);
    };
    img.src = url;
    wrap.appendChild(img);
  } else {
    const fb = document.createElement('div');
    fb.className = 'portrait-fallback';
    fb.textContent = initialsFor(key);
    wrap.appendChild(fb);
  }
  return wrap;
}

function charCard({mc, key, displayName, buildName, arch, pick, available, joinLevel, build}) {
  const choices = getChoices(displayName);
  const hasDisplay = pick && (pick.m || pick.e);

  const card = document.createElement('div');
  let cls = 'char-card';
  if (mc) cls += ' is-mc';
  if (!available) cls += ' unavailable';
  else if (!hasDisplay) cls += ' no-pick';
  card.className = cls;

  card.appendChild(makePortrait(key));

  const body = document.createElement('div');
  body.className = 'char-body';

  const row = document.createElement('div');
  row.className = 'char-row';
  const nameEl = document.createElement('div');
  nameEl.className = 'char-name';
  nameEl.textContent = displayName;
  const archEl = document.createElement('div');
  archEl.className = 'char-arch';
  archEl.textContent = getActiveArchetype(buildName, !mc, level, arch);
  row.appendChild(nameEl);
  row.appendChild(archEl);
  body.appendChild(row);

  if (buildName) {
    const bn = document.createElement('div');
    bn.className = 'char-build-name';
    bn.textContent = buildName;
    body.appendChild(bn);
  }

  if (!available) {
    const u = document.createElement('div');
    u.className = 'char-unavailable';
    u.textContent = `Joins at level ${joinLevel}`;
    body.appendChild(u);
  } else if (hasDisplay) {
    if (pick.m) {
      const p = document.createElement('div');
      p.className = 'char-pick';
      if (pick.m.includes('/') || pickHasInfo(pick.m)) p.classList.add('has-info');
      renderStyledPickText(pick.m, choices, level, p);
      body.appendChild(p);
    }
    if (pick.e) {
      const e = document.createElement('div');
      e.className = 'char-extra';
      renderStyledPickText(pick.e, choices, level, e);
      body.appendChild(e);
    }
    // Archetype callout at L16 / L36
    const callout = archetypeCalloutAtLevel(level, buildName, !mc);
    if (callout) {
      const ac = document.createElement('div');
      ac.className = 'char-archetype-callout';
      ac.innerHTML = `<span class="ac-tag">Tier&nbsp;${callout.tier}&nbsp;archetype</span> <span class="ac-name">${callout.archetype}</span>`;
      body.appendChild(ac);
    }
  } else {
    const empty = document.createElement('div');
    empty.className = 'char-empty';
    empty.textContent = '— no pick at this level —';
    body.appendChild(empty);
  }

  card.appendChild(body);
  attachCardInteractions(card, { displayName, buildName, arch, pick, available, build, mc, joinLevel, isCompanion: !mc });
  return card;
}

// ============= CARD INTERACTIONS (tap vs long-press) =============
const LONG_PRESS_MS = 480;

function attachCardInteractions(card, ctx) {
  let pressTimer = null;
  let didLongPress = false;
  let startX = 0, startY = 0;
  const MOVE_CANCEL = 10; // pixels

  function clearTimer() {
    if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
    card.classList.remove('long-pressing');
  }

  function start(e) {
    didLongPress = false;
    const t = e.touches ? e.touches[0] : e;
    startX = t.clientX; startY = t.clientY;
    pressTimer = setTimeout(() => {
      didLongPress = true;
      card.classList.remove('long-pressing');
      // haptic feedback if available
      if (navigator.vibrate) try { navigator.vibrate(15); } catch (e) {}
      openCatchupSheet(ctx);
    }, LONG_PRESS_MS);
    setTimeout(() => {
      if (pressTimer) card.classList.add('long-pressing');
    }, 100);
  }

  function move(e) {
    if (!pressTimer) return;
    const t = e.touches ? e.touches[0] : e;
    if (Math.abs(t.clientX - startX) > MOVE_CANCEL || Math.abs(t.clientY - startY) > MOVE_CANCEL) {
      clearTimer();
    }
  }

  function end(e) {
    if (didLongPress) { clearTimer(); didLongPress = false; return; }
    if (pressTimer) {
      clearTimer();
      // short tap → open description sheet
      openDescriptionSheet(ctx);
    }
  }

  function cancel() { clearTimer(); didLongPress = false; }

  card.addEventListener('touchstart', start, { passive: true });
  card.addEventListener('touchmove', move, { passive: true });
  card.addEventListener('touchend', end);
  card.addEventListener('touchcancel', cancel);
  card.addEventListener('mousedown', start);
  card.addEventListener('mousemove', move);
  card.addEventListener('mouseup', end);
  card.addEventListener('mouseleave', cancel);
  // Prevent the iOS context menu on long-press of text
  card.addEventListener('contextmenu', (e) => e.preventDefault());
}
