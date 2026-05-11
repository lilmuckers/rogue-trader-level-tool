// ============= CATCH-UP SHEET =============

// ── Stat Calculator ───────────────────────────────────────────────────────────
const _CHAR_MAP = {
  'weapon skill': 'WS',  'ws': 'WS',
  'ballistic skill': 'BS', 'bs': 'BS',
  'strength': 'STR',     'str': 'STR',
  'toughness': 'TGH',    'tgh': 'TGH',
  'agility': 'AGI',      'agi': 'AGI', 'agl': 'AGI',
  'perception': 'PER',   'per': 'PER',
  'fellowship': 'FEL',   'fel': 'FEL',
  'intelligence': 'INT', 'int': 'INT',
  'willpower': 'WILL',   'will': 'WILL',
};
const _CHAR_FULL = { WS:'Weapon Skill', BS:'Ballistic Skill', STR:'Strength', TGH:'Toughness', AGI:'Agility', PER:'Perception', FEL:'Fellowship', INT:'Intelligence', WILL:'Willpower' };
const _CHAR_ORDER = ['WS','BS','STR','TGH','AGI','PER','FEL','INT','WILL'];
const _SKILL_NAMES = new Set(['medicae','commerce','lore imperium','lore xenos','lore warp','persuasion','coercion','logic','tech-use','awareness','athletics','demolition','carouse','tracking','navigate warp']);

function _resolveCharAbbr(raw) {
  const lc = raw.toLowerCase().trim();
  // "characteristic training: X" pattern
  const ct = lc.match(/^characteristic\s+training\s*:?\s*(.+)$/);
  if (ct) return _CHAR_MAP[ct[1].trim()] || null;
  return _CHAR_MAP[lc] || null;
}

function _isSkillPick(raw) {
  const lc = raw.toLowerCase().trim();
  if (_SKILL_NAMES.has(lc)) return true;
  if (/^lore\s+/.test(lc)) return true;
  if (/^base\s+skill:?/.test(lc)) return true;
  return false;
}

function calcBuildStats(build, upToLevel) {
  const originBonuses = {}; // abbr → bonus (from origin text)
  const training = {};      // abbr → count of +5 picks
  let apGained = 0;
  const skillCounts = {};   // skill name → count

  // Parse origin bonuses: "BS +2 / Agility +2 / Fellowship +2"
  const origin = build.origin || '';
  for (const m of origin.matchAll(/([\w][\w\s]*?)\s*\+(\d+)/g)) {
    const abbr = _resolveCharAbbr(m[1].trim());
    if (abbr) originBonuses[abbr] = (originBonuses[abbr] || 0) + parseInt(m[2], 10);
  }

  // Walk levels
  for (let n = 1; n <= Math.min(upToLevel, 55); n++) {
    const entry = build.levels && build.levels[n];
    if (!entry) continue;
    [entry.m, entry.e].forEach(pick => {
      if (!pick) return;
      // Skip slash-choice picks (can't know which was taken)
      if (pick.includes('/')) return;
      // AP pick
      const apM = pick.match(/^ap\s*\+(\d+)$/i);
      if (apM) { apGained += parseInt(apM[1], 10); return; }
      // Characteristic
      const abbr = _resolveCharAbbr(pick);
      if (abbr) { training[abbr] = (training[abbr] || 0) + 1; return; }
      // Skill
      if (_isSkillPick(pick)) {
        const sk = pick.toLowerCase().trim().replace(/^base\s+skill:\s*/, '');
        skillCounts[sk] = (skillCounts[sk] || 0) + 1;
      }
    });
  }
  return { originBonuses, training, apGained, skillCounts };
}

function buildStatsPanel(ctx) {
  const { build, buildName } = ctx;
  const panel = document.createElement('div');
  panel.className = 'stats-panel';

  if (!build || !build.levels) {
    panel.textContent = 'No build data.';
    return panel;
  }

  const stats = calcBuildStats(build, level);

  // Origin bonuses section
  const hasOrigin = Object.keys(stats.originBonuses).length > 0;
  if (build.origin) {
    const originEl = document.createElement('div');
    originEl.className = 'stats-origin';
    originEl.textContent = build.origin;
    panel.appendChild(originEl);
  }

  // Characteristics table
  const hasCharStats = _CHAR_ORDER.some(a => stats.training[a] || stats.originBonuses[a]);
  if (hasCharStats) {
    const heading = document.createElement('div');
    heading.className = 'stats-heading';
    heading.textContent = `Characteristics at Level ${level}`;
    panel.appendChild(heading);

    const table = document.createElement('div');
    table.className = 'stats-table';

    // Header
    const hdr = document.createElement('div');
    hdr.className = 'stats-row stats-header';
    ['Characteristic','Origin','Training','Total'].forEach(h => {
      const c = document.createElement('div');
      c.className = 'stats-cell';
      c.textContent = h;
      hdr.appendChild(c);
    });
    table.appendChild(hdr);

    _CHAR_ORDER.forEach(abbr => {
      const origin = stats.originBonuses[abbr] || 0;
      const picks  = stats.training[abbr] || 0;
      if (!origin && !picks) return;
      const trainVal = picks * 5;
      const total = origin + trainVal;

      const row = document.createElement('div');
      row.className = 'stats-row';

      const nameCell = document.createElement('div');
      nameCell.className = 'stats-cell stats-name';
      const abbrEl = document.createElement('span');
      abbrEl.className = 'stats-abbr';
      abbrEl.textContent = abbr;
      const fullEl = document.createElement('span');
      fullEl.className = 'stats-fullname';
      fullEl.textContent = _CHAR_FULL[abbr];
      nameCell.appendChild(abbrEl);
      nameCell.appendChild(fullEl);
      row.appendChild(nameCell);

      [origin ? `+${origin}` : '—', trainVal ? `+${trainVal}` : '—', `+${total}`].forEach((val, i) => {
        const c = document.createElement('div');
        c.className = 'stats-cell' + (i === 2 ? ' stats-total' : '');
        c.textContent = val;
        row.appendChild(c);
      });
      table.appendChild(row);
    });
    panel.appendChild(table);
  }

  // AP
  if (stats.apGained > 0) {
    const apRow = document.createElement('div');
    apRow.className = 'stats-ap-row';
    const apLabel = document.createElement('span');
    apLabel.textContent = 'Action Points gained';
    const apVal = document.createElement('span');
    apVal.className = 'stats-ap-val';
    apVal.textContent = `+${stats.apGained} AP`;
    apRow.appendChild(apLabel);
    apRow.appendChild(apVal);
    panel.appendChild(apRow);
  }

  // Skills
  const skillEntries = Object.entries(stats.skillCounts);
  if (skillEntries.length > 0) {
    const sh = document.createElement('div');
    sh.className = 'stats-heading';
    sh.textContent = 'Skill Picks';
    panel.appendChild(sh);
    const skillList = document.createElement('div');
    skillList.className = 'stats-skill-list';
    skillEntries.sort((a,b) => a[0].localeCompare(b[0])).forEach(([sk, cnt]) => {
      const pill = document.createElement('span');
      pill.className = 'stats-skill-pill';
      const skName = sk.replace(/^(.)/, c => c.toUpperCase());
      pill.textContent = cnt > 1 ? `${skName} ×${cnt}` : skName;
      skillList.appendChild(pill);
    });
    panel.appendChild(skillList);
  }

  if (!hasCharStats && stats.apGained === 0 && skillEntries.length === 0) {
    const none = document.createElement('div');
    none.className = 'stats-none';
    none.textContent = "No characteristic or skill picks found in this build's data.";
    panel.appendChild(none);
  }

  return panel;
}
function openCatchupSheet(ctx) {
  const { displayName, build } = ctx;
  if (!build || !build.levels) return;
  openSheet(`${displayName} · Build Timeline`, () => buildCatchupContent(ctx));
}

function buildCatchupContent(ctx) {
  const { displayName, buildName, arch, build, mc, isCompanion } = ctx;
  const wrap = document.createElement('div');

  // Meta header
  const meta = document.createElement('div');
  meta.className = 'catchup-meta';
  const bn = document.createElement('div');
  bn.className = 'catchup-build-name';
  bn.textContent = buildName || '';
  meta.appendChild(bn);

  const archetypes = getBuildArchetypes(buildName, isCompanion);
  if (archetypes && (archetypes.t1 || archetypes.t2 || archetypes.t3)) {
    const path = document.createElement('div');
    path.className = 'catchup-archetype-path';
    const parts = [];
    if (archetypes.t1) parts.push(`<span class="ap-tier">${archetypes.t1}</span>`);
    if (archetypes.t2) parts.push(`<span class="ap-tier">${archetypes.t2}</span>`);
    if (archetypes.t3) parts.push(`<span class="ap-tier">${archetypes.t3}</span>`);
    path.innerHTML = parts.join('<span class="ap-arrow">→</span>');
    meta.appendChild(path);
  } else if (arch) {
    const ar = document.createElement('div');
    ar.className = 'catchup-archetype';
    ar.textContent = arch;
    meta.appendChild(ar);
  }
  if (build && build.dlc) {
    const dlcEl = document.createElement('div');
    dlcEl.className = 'dlc-badge dlc-badge-build';
    dlcEl.textContent = build.dlc;
    meta.appendChild(dlcEl);
  }
  wrap.appendChild(meta);

  // Party button (companions only)
  if (isCompanion && rosterHas(displayName)) {
    const partyBtn = document.createElement('button');
    const updatePartyBtn = () => {
      const inP = inParty(displayName);
      partyBtn.className = 'party-toggle-btn' + (inP ? ' in-party' : '');
      partyBtn.textContent = inP ? '★ In Party - Remove' : `☆ Add to Party${getParty().length >= MAX_PARTY ? ' (party full)' : ''}`;
      partyBtn.disabled = !inP && getParty().length >= MAX_PARTY;
    };
    updatePartyBtn();
    partyBtn.addEventListener('click', () => {
      if (inParty(displayName)) removeFromParty(displayName);
      else addToParty(displayName);
      updatePartyBtn();
      renderTracker();
    });
    wrap.appendChild(partyBtn);
  }

  // Tabs: Stats (default) | Timeline | Gear & Skills (if extras)
  const extras = getExtrasForBuildName(buildName, isCompanion);
  const hasExtras = extras && (extras.skills || (extras.gear && extras.gear.length));

  const tabBar = document.createElement('div');
  tabBar.className = 'tab-bar';
  const tabStats    = document.createElement('button');
  tabStats.className = 'tab-btn active';
  tabStats.textContent = 'Stats';
  const tabTimeline = document.createElement('button');
  tabTimeline.className = 'tab-btn';
  tabTimeline.textContent = 'Timeline';
  tabBar.appendChild(tabStats);
  tabBar.appendChild(tabTimeline);

  const statsPanel = buildStatsPanel(ctx);
  statsPanel.classList.add('tab-panel');
  const timelinePanel = document.createElement('div');
  timelinePanel.classList.add('tab-panel', 'hidden');
  let gearPanel = null;

  if (hasExtras) {
    const tabGear = document.createElement('button');
    tabGear.className = 'tab-btn';
    tabGear.textContent = 'Gear & Skills';
    tabBar.appendChild(tabGear);

    gearPanel = document.createElement('div');
    gearPanel.classList.add('tab-panel', 'hidden');

    const allTabs   = [tabStats, tabTimeline, tabGear];
    const allPanels = [statsPanel, timelinePanel, gearPanel];
    const activate  = (i) => {
      allTabs.forEach((t, j) => t.classList.toggle('active', j === i));
      allPanels.forEach((p, j) => p.classList.toggle('hidden', j !== i));
    };
    tabStats.addEventListener('click',    () => activate(0));
    tabTimeline.addEventListener('click', () => activate(1));
    tabGear.addEventListener('click',     () => activate(2));
  } else {
    const activate = (i) => {
      [tabStats, tabTimeline].forEach((t, j) => t.classList.toggle('active', j === i));
      [statsPanel, timelinePanel].forEach((p, j) => p.classList.toggle('hidden', j !== i));
    };
    tabStats.addEventListener('click',    () => activate(0));
    tabTimeline.addEventListener('click', () => activate(1));
  }

  wrap.appendChild(tabBar);

  // === Timeline panel ===
  const choices = getChoices(displayName);
  for (let n = 1; n <= MAX_LVL; n++) {
    const entry = build.levels[n];
    if (!entry || (!entry.m && !entry.e)) continue;

    const item = document.createElement('div');
    item.className = 'timeline-item';
    if (n === level) item.classList.add('is-current');

    const lvlBox = document.createElement('div');
    lvlBox.className = 'timeline-level';
    const lvlNum = document.createElement('div');
    lvlNum.className = 'timeline-level-num';
    lvlNum.textContent = n;
    const lvlTag = document.createElement('div');
    lvlTag.className = 'timeline-level-tag';
    lvlTag.textContent = n === level ? 'NOW' : 'LVL';
    lvlBox.appendChild(lvlNum);
    lvlBox.appendChild(lvlTag);
    item.appendChild(lvlBox);

    const pickCol = document.createElement('div');
    pickCol.className = 'timeline-pick';

    const mHasInfo = entry.m && (entry.m.includes('/') || pickHasInfo(entry.m));
    const eHasInfo = entry.e && (entry.e.includes('/') || pickHasInfo(entry.e));
    if (mHasInfo || eHasInfo) {
      item.classList.add('has-info');
      item.addEventListener('click', () => pushLevelDescription(entry, displayName, n));
    }

    if (entry.m) {
      const m = document.createElement('div');
      m.className = 'timeline-main' + (mHasInfo ? ' has-info' : '');
      renderStyledPickText(entry.m, choices, n, m);
      pickCol.appendChild(m);
    }
    if (entry.e) {
      const ex = document.createElement('div');
      ex.className = 'timeline-extra' + (eHasInfo ? ' has-info' : '');
      renderStyledPickText(entry.e, choices, n, ex);
      pickCol.appendChild(ex);
    }
    const callout = archetypeCalloutAtLevel(n, buildName, isCompanion);
    if (callout) {
      const ac = document.createElement('div');
      ac.className = 'char-archetype-callout';
      ac.style.marginTop = '8px';
      ac.innerHTML = `<span class="ac-tag">Tier&nbsp;${callout.tier}&nbsp;archetype</span> <span class="ac-name">${callout.archetype}</span>`;
      pickCol.appendChild(ac);
    }
    item.appendChild(pickCol);
    timelinePanel.appendChild(item);
  }
  wrap.appendChild(statsPanel);
  wrap.appendChild(timelinePanel);

  // === Gear & Skills panel ===
  if (hasExtras && gearPanel) {
    if (extras.skills) {
      const panel = document.createElement('div');
      panel.className = 'extras-panel';
      const h = document.createElement('div');
      h.className = 'extras-heading';
      h.textContent = 'Skill Options';
      panel.appendChild(h);
      const s = document.createElement('div');
      s.className = 'skills-block';
      s.textContent = extras.skills;
      panel.appendChild(s);
      gearPanel.appendChild(panel);
    }
    if (extras.gear && extras.gear.length) {
      const panel = document.createElement('div');
      panel.className = 'extras-panel';
      const h = document.createElement('div');
      h.className = 'extras-heading';
      h.textContent = 'Gear to Consider';
      panel.appendChild(h);
      const list = document.createElement('div');
      list.className = 'gear-list';
      extras.gear.forEach(slot => {
        const row = document.createElement('div');
        row.className = 'gear-row';
        const slotLabel = document.createElement('div');
        slotLabel.className = 'gear-slot';
        slotLabel.textContent = slot.slot;
        row.appendChild(slotLabel);
        const optsCol = document.createElement('div');
        optsCol.className = 'gear-options';
        slot.options.split('/').map(o => o.trim()).filter(Boolean).forEach(opt => {
          const pill = document.createElement('span');
          pill.className = 'gear-pill';
          const cleaned = opt.replace(/\s*\(.*?\)\s*$/, '').trim();
          const found = lookupGear(cleaned);
          pill.textContent = opt;
          if (found && (found.l || found.a != null || found.d)) {
            if (found.a != null) {
              const loc = document.createElement('span');
              loc.className = 'gear-pill-loc';
              loc.textContent = '· ' + actToText(found.a);
              pill.appendChild(loc);
            }
            const gearBadge = makeDlcBadge(found.dlc);
            if (gearBadge) { gearBadge.className = 'dlc-badge dlc-badge-pill'; pill.appendChild(gearBadge); }
            pill.addEventListener('click', () => pushGearDetail(found, opt));
          } else {
            pill.classList.add('unknown');
          }
          optsCol.appendChild(pill);
        });
        row.appendChild(optsCol);
        list.appendChild(row);
      });
      panel.appendChild(list);
      gearPanel.appendChild(panel);
    }
    wrap.appendChild(gearPanel);
  }

  return wrap;
}

// Push a gear-detail sheet on top of the catch-up timeline
function pushGearDetail(gearItem, displayName) {
  pushSheet(gearItem.n || displayName, () => buildGearDetailContent(gearItem));
}

function buildGearDetailContent(gearItem) {
  const wrap = document.createElement('div');

  if (gearItem.dlc) {
    const dlcEl = document.createElement('div');
    dlcEl.className = 'dlc-badge dlc-badge-gear';
    dlcEl.textContent = gearItem.dlc;
    wrap.appendChild(dlcEl);
  }

  const detail = document.createElement('div');
  detail.className = 'gear-detail';

  if (gearItem.cat) {
    const r = document.createElement('div');
    r.className = 'gear-detail-row';
    const l = document.createElement('div');
    l.className = 'gear-detail-label';
    l.textContent = 'Category';
    const v = document.createElement('div');
    v.className = 'gear-detail-value';
    v.textContent = gearItem.cat;
    r.appendChild(l); r.appendChild(v); detail.appendChild(r);
  }

  if (gearItem.s && !gearItem.cat) {
    const r = document.createElement('div');
    r.className = 'gear-detail-row';
    const l = document.createElement('div');
    l.className = 'gear-detail-label';
    l.textContent = 'Slot';
    const v = document.createElement('div');
    v.className = 'gear-detail-value';
    v.textContent = gearItem.s.charAt(0).toUpperCase() + gearItem.s.slice(1);
    r.appendChild(l); r.appendChild(v); detail.appendChild(r);
  }

  if (gearItem.l) {
    const r = document.createElement('div');
    r.className = 'gear-detail-row';
    const l = document.createElement('div');
    l.className = 'gear-detail-label';
    l.textContent = 'Where';
    const v = document.createElement('div');
    v.className = 'gear-detail-value';
    v.textContent = gearItem.l;
    r.appendChild(l); r.appendChild(v); detail.appendChild(r);
  }

  if (gearItem.a != null) {
    const r = document.createElement('div');
    r.className = 'gear-detail-row';
    const l = document.createElement('div');
    l.className = 'gear-detail-label';
    l.textContent = 'When';
    const v = document.createElement('div');
    v.className = 'gear-detail-value';
    v.textContent = actToText(gearItem.a);
    r.appendChild(l); r.appendChild(v); detail.appendChild(r);
  }

  if (gearItem.d) {
    const r = document.createElement('div');
    r.className = 'gear-detail-row';
    const l = document.createElement('div');
    l.className = 'gear-detail-label';
    l.textContent = 'Effect';
    const v = document.createElement('div');
    v.className = 'gear-detail-value';
    v.textContent = gearItem.d;
    r.appendChild(l); r.appendChild(v); detail.appendChild(r);
  }

  if (!gearItem.l && gearItem.a == null && !gearItem.d) {
    const empty = document.createElement('div');
    empty.className = 'desc-text-missing';
    empty.textContent = 'No location or effect data found for this item.';
    detail.appendChild(empty);
  }

  wrap.appendChild(detail);
  return wrap;
}

// Push a combined level description (all picks for one level) — mirrors the
// main-screen description sheet so clicking a row shows everything at once.
function pushLevelDescription(entry, displayName, atLevel) {
  const title = `Level ${atLevel} · ${displayName}`;
  pushSheet(title, () => {
    const wrap = document.createElement('div');
    const meta = document.createElement('div');
    meta.className = 'desc-context';
    meta.textContent = `${displayName} · level ${atLevel}`;
    wrap.appendChild(meta);

    const renderPickBlock = (rawPick, isExtra) => {
      if (!rawPick) return;
      if (rawPick.includes('/')) {
        renderChoiceSection(rawPick, displayName, atLevel, wrap, isExtra);
        return;
      }
      if (isSkillStatPick(rawPick)) {
        const hit = lookupStatPick(rawPick);
        const block = document.createElement('div');
        block.className = 'desc-block';
        const nm = document.createElement('div');
        nm.className = 'desc-name';
        nm.textContent = (isExtra ? '+ ' : '') + rawPick;
        const src = document.createElement('div');
        src.className = 'desc-source';
        src.textContent = hit ? hit.kind : 'Skill / Stat allocation';
        block.appendChild(nm); block.appendChild(src);
        const txt = document.createElement('div');
        txt.className = hit ? 'desc-text' : 'desc-text-missing';
        txt.textContent = hit ? hit.desc : 'A characteristic, skill, or AP allocation.';
        block.appendChild(txt);
        wrap.appendChild(block);
        return;
      }
      const hits = lookupPick(rawPick);
      if (hits.length === 0) {
        const block = document.createElement('div');
        block.className = 'desc-block';
        const nm = document.createElement('div');
        nm.className = 'desc-name';
        nm.textContent = (isExtra ? '+ ' : '') + rawPick;
        const txt = document.createElement('div');
        txt.className = 'desc-text-missing';
        txt.textContent = 'No description available.';
        block.appendChild(nm); block.appendChild(txt);
        wrap.appendChild(block);
        return;
      }
      hits.forEach((hit, i) => {
        const block = document.createElement('div');
        block.className = 'desc-block';
        const nm = document.createElement('div');
        nm.className = 'desc-name';
        nm.textContent = (isExtra && i === 0 ? '+ ' : '') + hit.name + (hit.tierStripped ? ` - ${rawPick}` : '');
        const src = document.createElement('div');
        src.className = 'desc-source';
        src.textContent = hit.kind;
        const txt = document.createElement('div');
        txt.className = 'desc-text';
        txt.textContent = hit.desc;
        block.appendChild(nm); block.appendChild(src);
        const b1 = makeDlcBadge(hit.dlc); if (b1) block.appendChild(b1);
        block.appendChild(txt);
        wrap.appendChild(block);
      });
    };

    renderPickBlock(entry.m, false);
    renderPickBlock(entry.e, true);
    return wrap;
  });
}

// Push a single-pick description on top of whatever's currently open.
// Used both from the catch-up timeline (where back returns to the timeline)
// and could be used elsewhere for the same nesting pattern.
function pushSinglePickDescription(rawPick, displayName, atLevel) {
  pushSheet(rawPick, () => buildSinglePickContent(rawPick, displayName, atLevel));
}

function buildSinglePickContent(rawPick, displayName, atLevel) {
  const wrap = document.createElement('div');
  const meta = document.createElement('div');
  meta.className = 'desc-context';
  meta.textContent = `${displayName} · level ${atLevel}`;
  wrap.appendChild(meta);

  // Slash pick → show choice selector (same as description sheet)
  if (rawPick.includes('/')) {
    renderChoiceSection(rawPick, displayName, atLevel, wrap, false);
    return wrap;
  }

  if (isSkillStatPick(rawPick)) {
    const hit = lookupStatPick(rawPick);
    const block = document.createElement('div');
    block.className = 'desc-block';
    const nm = document.createElement('div');
    nm.className = 'desc-name';
    nm.textContent = rawPick;
    const src = document.createElement('div');
    src.className = 'desc-source';
    src.textContent = hit ? hit.kind : 'Skill / Stat allocation';
    block.appendChild(nm); block.appendChild(src);
    const txt = document.createElement('div');
    txt.className = hit ? 'desc-text' : 'desc-text-missing';
    txt.textContent = hit ? hit.desc : 'A characteristic, skill, or AP allocation.';
    block.appendChild(txt);
    wrap.appendChild(block);
  } else {
    const hits = lookupPick(rawPick);
    if (hits.length === 0) {
      const block = document.createElement('div');
      block.className = 'desc-block';
      const nm = document.createElement('div');
      nm.className = 'desc-name';
      nm.textContent = rawPick;
      const txt = document.createElement('div');
      txt.className = 'desc-text-missing';
      txt.textContent = 'No description available.';
      block.appendChild(nm); block.appendChild(txt);
      wrap.appendChild(block);
    } else {
      hits.forEach(hit => {
        const block = document.createElement('div');
        block.className = 'desc-block';
        const nm = document.createElement('div');
        nm.className = 'desc-name';
        nm.textContent = hit.name + (hit.tierStripped ? ` - ${rawPick}` : '');
        const src = document.createElement('div');
        src.className = 'desc-source';
        src.textContent = hit.kind;
        const txt = document.createElement('div');
        txt.className = 'desc-text';
        txt.textContent = hit.desc;
        block.appendChild(nm); block.appendChild(src);
        const b2 = makeDlcBadge(hit.dlc); if (b2) block.appendChild(b2);
        block.appendChild(txt);
        wrap.appendChild(block);
      });
    }
  }
  return wrap;
}
