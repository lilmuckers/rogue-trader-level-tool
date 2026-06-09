// ============= TRADERS =============

// KEY_ constants are in store.js

function getTradersAct() { return Store.get(KEY_TRADERS_ACT) || 1; }
function setTradersAct(act) { Store.set(KEY_TRADERS_ACT, act); }
function getFactionRep(factionName) {
  return (Store.get(KEY_TRADERS_REP) || {})[factionName] || 0;
}
function setFactionRep(factionName, rep) {
  Store.mutate(KEY_TRADERS_REP, all => { all[factionName] = Math.max(0, rep); });
}
function getProfitFactor() { return Store.get(KEY_PROFIT_FACTOR) || 0; }
function setProfitFactor(pf) { Store.set(KEY_PROFIT_FACTOR, Math.max(0, pf)); }

function vendorItemAvailable(item, rep, act) {
  if (act < item.act) return false;
  if (item.pf && getProfitFactor() < item.pf) return false;
  if (typeof item.rep === 'number') return rep >= item.rep;
  return true;
}
function vendorItemLockReason(item, rep, act) {
  if (act < item.act) return `Available in Act ${item.act}`;
  if (item.pf && getProfitFactor() < item.pf) return `Requires PF ${item.pf}`;
  if (typeof item.rep === 'number' && rep < item.rep) return `Requires rep ${item.rep}`;
  return null;
}
// Alignment vendor helpers
const ALIGNMENTS = ['Dogmatic', 'Iconoclast', 'Heretic'];
function getAlignRanks() { return Store.get(KEY_ALIGN_RANKS) || { Dogmatic: 0, Iconoclast: 0, Heretic: 0 }; }
function setAlignRank(alignment, rank) {
  Store.mutate(KEY_ALIGN_RANKS, all => { all[alignment] = Math.max(0, rank); });
}
function alignItemAvailable(item, rank, act) {
  if (act < item.act) return false;
  if (item.pf && getProfitFactor() < item.pf) return false;
  return rank >= (item.rank || 0);
}
function curiosityAvailCount(vendor, act) {
  const ranks = getAlignRanks();
  const neutral = vendor.neutral_items.filter(it => act >= it.act).length;
  return neutral + ALIGNMENTS.reduce((sum, a) => {
    const items = vendor[a.toLowerCase() + '_items'] || [];
    return sum + items.filter(it => alignItemAvailable(it, ranks[a], act)).length;
  }, 0);
}

let _traderSearchText = '';

function renderTradersSection() {
  const el = $('traders-content');
  el.innerHTML = '';
  if (!DATA.vendors || !DATA.vendors.length) { el.textContent = 'No vendor data available.'; return; }

  const act = getTradersAct();

  // Act selector
  const actRow = document.createElement('div');
  actRow.className = 'traders-act-row';
  [1, 2, 3, 4].forEach(a => {
    const btn = document.createElement('button');
    btn.className = 'traders-act-btn' + (a === act ? ' active' : '');
    btn.textContent = `Act ${a}`;
    btn.addEventListener('click', () => { setTradersAct(a); renderTradersSection(); });
    actRow.appendChild(btn);
  });
  el.appendChild(actRow);

  // Profit Factor stepper
  const pfRow = document.createElement('div');
  pfRow.className = 'traders-pf-row';
  const pfLabel = document.createElement('span');
  pfLabel.className = 'traders-pf-label';
  pfLabel.textContent = 'Profit Factor';
  const pfDown = document.createElement('button');
  pfDown.className = 'traders-pf-btn'; pfDown.textContent = '−';
  const pfVal = document.createElement('div');
  pfVal.className = 'traders-pf-val'; pfVal.textContent = getProfitFactor();
  const pfUp = document.createElement('button');
  pfUp.className = 'traders-pf-btn'; pfUp.textContent = '+';
  const updatePF = (delta) => {
    setProfitFactor(getProfitFactor() + delta);
    pfVal.textContent = getProfitFactor();
    // Re-render faction list without blowing away the whole section
    renderFactionList(factionListEl, act);
  };
  function addHoldRepeat(btn, delta) {
    let holdTimer = null, repeatInterval = null, wasHeld = false;
    const stop = () => {
      clearTimeout(holdTimer); clearInterval(repeatInterval);
      holdTimer = null; repeatInterval = null;
    };
    // Touch path — preventDefault+stopPropagation blocks iOS callout/selection/synthetic-click
    btn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      e.stopPropagation();
      wasHeld = false;
      holdTimer = setTimeout(() => {
        wasHeld = true;
        updatePF(delta);
        repeatInterval = setInterval(() => updatePF(delta), 100);
      }, 800);
    }, { passive: false });
    btn.addEventListener('touchend', (e) => {
      e.preventDefault();
      if (!wasHeld) updatePF(delta);
      wasHeld = false;
      stop();
    });
    // touchcancel intentionally NOT calling stop() — iOS fires it on long-press selection
    // touch-action:none + preventDefault should prevent selection from starting
    // Mouse path (desktop / preview)
    btn.addEventListener('mousedown', () => {
      wasHeld = false;
      holdTimer = setTimeout(() => {
        wasHeld = true;
        repeatInterval = setInterval(() => updatePF(delta), 100);
      }, 1000);
    });
    btn.addEventListener('click', () => { if (!wasHeld) updatePF(delta); wasHeld = false; });
    btn.addEventListener('mouseup',    stop);
    btn.addEventListener('mouseleave', stop);
  }
  addHoldRepeat(pfDown, -1);
  addHoldRepeat(pfUp,   +1);
  pfRow.append(pfLabel, pfDown, pfVal, pfUp);
  el.appendChild(pfRow);

  // Search bar
  const searchInput = document.createElement('input');
  searchInput.className = 'traders-search';
  searchInput.type = 'search';
  searchInput.placeholder = 'Search items across all factions…';
  searchInput.value = _traderSearchText;
  searchInput.addEventListener('input', (e) => { _traderSearchText = e.target.value; renderTradersSection(); });
  el.appendChild(searchInput);
  if (_traderSearchText) {
    requestAnimationFrame(() => {
      searchInput.focus();
      searchInput.setSelectionRange(searchInput.value.length, searchInput.value.length);
    });
  }

  const factionListEl = document.createElement('div');
  el.appendChild(factionListEl);

  const query = _traderSearchText.trim().toLowerCase();
  if (query.length >= 2) {
    const matches = [];
    DATA.vendors.forEach(faction => {
      if (faction.alignment_vendor) {
        const allItems = [
          ...faction.neutral_items.map(it => ({ ...it, alignment: null })),
          ...ALIGNMENTS.flatMap(a => (faction[a.toLowerCase() + '_items'] || []).map(it => ({ ...it, alignment: a }))),
        ];
        allItems.forEach(item => {
          if (item.name.toLowerCase().includes(query)) matches.push({ item, factionName: faction.name, faction });
        });
      } else {
        faction.items.forEach(item => {
          if (item.name.toLowerCase().includes(query)) matches.push({ item, factionName: faction.name, faction });
        });
      }
    });
    if (!matches.length) {
      const empty = document.createElement('div');
      empty.style.cssText = 'color:var(--ink-dim);padding:12px 0;font-size:15px;';
      empty.textContent = 'No items found.';
      el.appendChild(empty);
    } else {
      matches.forEach(({ item, factionName, faction }) => {
        const rep = getFactionRep(factionName);
        const available = faction.alignment_vendor
          ? alignItemAvailable(item, item.alignment ? getAlignRanks()[item.alignment] : 99, act)
          : vendorItemAvailable(item, rep, act);
        const row = document.createElement('div');
        row.className = 'search-result-item';
        const pfStr = item.pf ? `<span class="search-result-pf">PF ${item.pf}</span>` : '';
        const metaParts = [factionName, item.alignment ? `${item.alignment} rank ${item.rank||0}+` : null, `Act ${item.act}`].filter(Boolean);
        row.innerHTML = `<div class="search-result-name">${item.name}${pfStr}</div>
          <div class="search-result-meta">${metaParts.join(' · ')}${!available ? ' <em style="color:var(--ink-faint)">(locked)</em>' : ''}</div>`;
        row.addEventListener('click', () => {
          _traderSearchText = '';
          if (faction.alignment_vendor) openCuriositySheet(faction, act);
          else openFactionSheet(faction, act, item.name);
        });
        factionListEl.appendChild(row);
      });
    }
    return;
  }

  renderFactionList(factionListEl, act);
}

function renderFactionList(el, act) {
  el.innerHTML = '';
  DATA.vendors.forEach(faction => {
    const card = document.createElement('div');
    if (faction.alignment_vendor) {
      const availCount = curiosityAvailCount(faction, act);
      card.className = 'faction-card curiosity-vendor-card';
      const header = document.createElement('div');
      header.className = 'faction-card-header';
      header.innerHTML = `<div class="faction-name">${faction.name}</div>
        <div class="faction-available-count">${availCount} available</div>`;
      card.appendChild(header);
      const alignRow = document.createElement('div');
      alignRow.className = 'curiosity-align-row';
      ALIGNMENTS.forEach(a => {
        const ranks = getAlignRanks();
        const items = faction[a.toLowerCase() + '_items'] || [];
        const avail = items.filter(it => alignItemAvailable(it, ranks[a], act)).length;
        const pill = document.createElement('div');
        pill.className = 'curiosity-align-pill';
        pill.innerHTML = `<span class="curiosity-align-name">${a}</span><span class="curiosity-align-rank">Rank ${ranks[a]}</span><span class="curiosity-align-avail">${avail} avail</span>`;
        alignRow.appendChild(pill);
      });
      card.appendChild(alignRow);
      card.addEventListener('click', () => openCuriositySheet(faction, act));
    } else {
      const rep = getFactionRep(faction.name);
      const availCount = faction.items.filter(it => vendorItemAvailable(it, rep, act)).length;
      card.className = 'faction-card';
      card.innerHTML = `<div class="faction-card-header">
        <div class="faction-name">${faction.name}</div>
        <div class="faction-rep-badge">Rep ${rep}</div>
        <div class="faction-available-count">${availCount} available</div>
      </div>`;
      card.addEventListener('click', () => openFactionSheet(faction, act, null));
    }
    el.appendChild(card);
  });
}

function openFactionSheet(faction, act, scrollToItem) {
  openSheet(faction.name, () => buildFactionContent(faction, act, scrollToItem));
}

let _curiosityActiveAlignment = 'Dogmatic';
function openCuriositySheet(vendor, act) {
  openSheet(vendor.name, () => buildCuriosityContent(vendor, act));
}

function buildCuriosityContent(vendor, act) {
  const wrap = document.createElement('div');
  let activeAlign = _curiosityActiveAlignment;

  // Alignment tab bar
  const tabBar = document.createElement('div');
  tabBar.className = 'tab-bar';
  const contentEl = document.createElement('div');

  function buildAlignContent() {
    contentEl.innerHTML = '';
    const ranks = getAlignRanks();
    let rank = ranks[activeAlign];
    const items = vendor[activeAlign.toLowerCase() + '_items'] || [];
    const maxRank = items.reduce((m, it) => Math.max(m, it.rank || 0), 0);

    // Rank stepper
    const rankControls = document.createElement('div');
    rankControls.className = 'faction-rep-controls';
    const rankLabel = document.createElement('div');
    rankLabel.className = 'faction-rep-label';
    rankLabel.textContent = `${activeAlign} rank`;
    const rankDown = document.createElement('button');
    rankDown.className = 'faction-rep-btn'; rankDown.textContent = '−';
    const rankVal = document.createElement('div');
    rankVal.className = 'faction-rep-val'; rankVal.textContent = rank;
    const rankUp = document.createElement('button');
    rankUp.className = 'faction-rep-btn'; rankUp.textContent = '+';
    const updateRank = (delta) => {
      rank = Math.max(0, Math.min(maxRank, rank + delta));
      setAlignRank(activeAlign, rank);
      rankVal.textContent = rank;
      buildSections();
      renderTradersSection();
    };
    rankDown.addEventListener('click', () => updateRank(-1));
    rankUp.addEventListener('click',   () => updateRank(+1));
    rankControls.append(rankLabel, rankDown, rankVal, rankUp);
    contentEl.appendChild(rankControls);

    const itemsEl = document.createElement('div');
    contentEl.appendChild(itemsEl);

    function buildSections() {
      itemsEl.innerHTML = '';
      const allItems = [
        ...vendor.neutral_items.map(it => ({ ...it, _neutral: true })),
        ...items,
      ];
      const available = allItems.filter(it => alignItemAvailable(it, rank, act));
      const locked    = allItems.filter(it => !alignItemAvailable(it, rank, act));
      if (available.length) {
        const h = document.createElement('div');
        h.className = 'vendor-section-heading'; h.textContent = 'Available';
        itemsEl.appendChild(h);
        available.forEach(it => itemsEl.appendChild(buildAlignVendorItemEl(it, true, act)));
      }
      if (locked.length) {
        const h = document.createElement('div');
        h.className = 'vendor-section-heading'; h.textContent = 'Locked';
        itemsEl.appendChild(h);
        locked.forEach(it => itemsEl.appendChild(buildAlignVendorItemEl(it, false, act)));
      }
    }
    buildSections();
  }

  ALIGNMENTS.forEach(a => {
    const btn = document.createElement('button');
    btn.className = 'tab-btn' + (a === activeAlign ? ' active' : '');
    btn.textContent = a;
    btn.addEventListener('click', () => {
      activeAlign = a;
      _curiosityActiveAlignment = a;
      tabBar.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.textContent === a));
      buildAlignContent();
    });
    tabBar.appendChild(btn);
  });

  wrap.appendChild(tabBar);
  wrap.appendChild(contentEl);
  buildAlignContent();
  return wrap;
}

function buildAlignVendorItemEl(item, available, act) {
  const el = document.createElement('div');
  el.className = 'vendor-item' + (available ? ' available' : ' locked');
  el.dataset.itemName = item.name;
  const pfHtml = item.pf ? `<span class="vendor-item-pf">PF ${item.pf}</span>` : '';
  const metaParts = [];
  if (!item._neutral && item.rank) metaParts.push(`Rank ${item.rank}+`);
  metaParts.push(`Act ${item.act}`);
  el.innerHTML = `<div class="vendor-item-header"><div class="vendor-item-name">${item.name}</div>${pfHtml}</div>
    <div class="vendor-item-meta">${metaParts.join(' · ')}</div>`;
  if (!available && act < item.act) {
    const lock = document.createElement('div');
    lock.className = 'vendor-item-lock-reason';
    lock.textContent = `Available in Act ${item.act}`;
    el.appendChild(lock);
  }
  el.addEventListener('click', () => {
    const found = lookupGear(item.name.replace(/\s*\(.*?\)\s*$/, '').trim());
    if (found) pushGearDetail(found, item.name);
  });
  return el;
}

function buildFactionContent(faction, act, scrollToItem) {
  const wrap = document.createElement('div');
  let rep = getFactionRep(faction.name);
  const maxRep = faction.items.reduce((m, it) => typeof it.rep === 'number' ? Math.max(m, it.rep) : m, 0);

  // Rep stepper
  const repControls = document.createElement('div');
  repControls.className = 'faction-rep-controls';
  const repLabel = document.createElement('div');
  repLabel.className = 'faction-rep-label';
  repLabel.textContent = 'Reputation level';
  const repDown = document.createElement('button');
  repDown.className = 'faction-rep-btn'; repDown.textContent = '−';
  const repVal = document.createElement('div');
  repVal.className = 'faction-rep-val'; repVal.textContent = rep;
  const repUp = document.createElement('button');
  repUp.className = 'faction-rep-btn'; repUp.textContent = '+';

  const updateRep = (delta) => {
    rep = Math.max(0, Math.min(maxRep, rep + delta));
    setFactionRep(faction.name, rep);
    repVal.textContent = rep;
    buildItems();
    renderTradersSection();
  };
  repDown.addEventListener('click', () => updateRep(-1));
  repUp.addEventListener('click',   () => updateRep(+1));
  repControls.append(repLabel, repDown, repVal, repUp);
  wrap.appendChild(repControls);

  const itemsEl = document.createElement('div');
  wrap.appendChild(itemsEl);

  function buildItems() {
    itemsEl.innerHTML = '';
    const available = faction.items.filter(it => vendorItemAvailable(it, rep, act));
    const locked    = faction.items.filter(it => !vendorItemAvailable(it, rep, act));

    if (available.length) {
      const h = document.createElement('div');
      h.className = 'vendor-section-heading'; h.textContent = 'Available';
      itemsEl.appendChild(h);
      available.forEach(item => itemsEl.appendChild(buildVendorItemEl(item, true, faction.name)));
    }
    if (locked.length) {
      const h = document.createElement('div');
      h.className = 'vendor-section-heading'; h.textContent = 'Locked';
      itemsEl.appendChild(h);
      locked.forEach(item => itemsEl.appendChild(buildVendorItemEl(item, false, faction.name)));
    }

    if (scrollToItem) {
      requestAnimationFrame(() => {
        const all = itemsEl.querySelectorAll('[data-item-name]');
        for (const el of all) {
          if (el.dataset.itemName === scrollToItem) {
            el.scrollIntoView({ block: 'center' });
            el.style.outline = '1px solid var(--gold)';
            setTimeout(() => { el.style.outline = ''; }, 1500);
            break;
          }
        }
      });
    }
  }

  buildItems();
  return wrap;
}

function buildVendorItemEl(item, available, factionName) {
  const el = document.createElement('div');
  el.className = 'vendor-item' + (available ? ' available' : ' locked');
  el.dataset.itemName = item.name;
  const pfHtml = item.pf ? `<span class="vendor-item-pf">PF ${item.pf}</span>` : '';
  el.innerHTML = `<div class="vendor-item-header"><div class="vendor-item-name">${item.name}</div>${pfHtml}</div>
    <div class="vendor-item-meta">Rep ${item.rep} · Act ${item.act}</div>`;
  if (!available) {
    const lock = document.createElement('div');
    lock.className = 'vendor-item-lock-reason';
    lock.textContent = vendorItemLockReason(item, getFactionRep(factionName), getTradersAct()) || '';
    el.appendChild(lock);
  }
  el.addEventListener('click', () => {
    const found = lookupGear(item.name.replace(/\s*\(.*?\)\s*$/, '').trim());
    if (found) pushGearDetail(found, item.name);
  });
  return el;
}
