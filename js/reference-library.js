// ============= REFERENCE LIBRARY SECTIONS =============
// Abilities, Talents, Skills, Character Creation, MC Builds, Retinue

// ── Shared helpers ────────────────────────────────────────────────────────────

function _makeLibSearch(placeholder, onInput) {
  const wrap = document.createElement('div');
  wrap.className = 'lib-search-wrap';
  const inp = document.createElement('input');
  inp.type = 'text';
  inp.className = 'lib-search';
  inp.placeholder = placeholder;
  const clear = document.createElement('button');
  clear.className = 'lib-search-clear';
  clear.textContent = '✕';
  clear.style.display = 'none';
  inp.addEventListener('input', () => {
    clear.style.display = inp.value ? '' : 'none';
    onInput(inp.value);
  });
  clear.addEventListener('click', () => {
    inp.value = ''; clear.style.display = 'none'; inp.focus(); onInput('');
  });
  wrap.appendChild(inp);
  wrap.appendChild(clear);
  return wrap;
}

function _renderDefList(el, entries, query, sectionId) {
  el.innerHTML = '';
  const q = query ? query.toLowerCase() : '';
  let count = 0;
  entries.forEach(([name, desc, dlc]) => {
    if (q && !name.toLowerCase().includes(q) && !(desc || '').toLowerCase().includes(q)) return;
    count++;
    const row = document.createElement('div');
    row.className = 'lib-def-row';
    const header = document.createElement('div');
    header.className = 'lib-def-header';
    const nm = document.createElement('span');
    nm.className = 'lib-def-name';
    nm.textContent = name;
    header.appendChild(nm);
    if (dlc) {
      const badge = makeDlcBadge(dlc);
      if (badge) { badge.className = 'dlc-badge dlc-badge-pill'; header.appendChild(badge); }
    }
    header.appendChild(_makeFavBtn({ id: 'fav_def_' + name, label: name, sub: typeof desc === 'string' ? desc.slice(0,60) : '', sectionId: sectionId || 'abilities' }));
    row.appendChild(header);
    if (desc) {
      const d = document.createElement('div');
      d.className = 'lib-def-desc';
      d.textContent = desc;
      row.appendChild(d);
    }
    el.appendChild(row);
  });
  if (!count) {
    const em = document.createElement('div');
    em.className = 'gb-empty';
    em.textContent = 'No results.';
    el.appendChild(em);
  }
}

// ── Abilities ─────────────────────────────────────────────────────────────────

function renderAbilitiesSection(el) {
  el.innerHTML = '';
  const dlcTags = DATA.definitions.dlcTags || {};
  const entries = Object.entries(DATA.definitions.abilities || {})
    .map(([k, v]) => [k, typeof v === 'string' ? v : v.desc || '', dlcTags[k] || null])
    .sort((a, b) => a[0].localeCompare(b[0]));

  const listEl = document.createElement('div');
  listEl.className = 'lib-def-list';

  const search = _makeLibSearch('Search abilities…', q => _renderDefList(listEl, entries, q, 'abilities'));
  el.appendChild(search);
  el.appendChild(listEl);
  _renderDefList(listEl, entries, '', 'abilities');
}

// ── Talents ───────────────────────────────────────────────────────────────────

function renderTalentsSection(el) {
  el.innerHTML = '';
  const dlcTags = DATA.definitions.dlcTags || {};
  const entries = Object.entries(DATA.definitions.talents || {})
    .map(([k, v]) => [k, typeof v === 'string' ? v : v.desc || '', dlcTags[k] || null])
    .sort((a, b) => a[0].localeCompare(b[0]));

  const listEl = document.createElement('div');
  listEl.className = 'lib-def-list';

  const search = _makeLibSearch('Search talents…', q => _renderDefList(listEl, entries, q, 'talents'));
  el.appendChild(search);
  el.appendChild(listEl);
  _renderDefList(listEl, entries, '', 'talents');
}

// ── Skills & Characteristics ──────────────────────────────────────────────────

const _CHAR_STAT_NAMES = new Set([
  'Weapon Skill','Ballistic Skill','Strength','Toughness','Agility',
  'Perception','Willpower','Fellowship','Intelligence',
  'WS','BS','STR','TGH','AGI','AGL','Agi','PER','Per','FEL','Fel','Int','Will','WILL',
  'AP +1','AP +2','Ap +1',
]);

function renderSkillsSection(el) {
  el.innerHTML = '';
  const chars = DATA.definitions.characteristics || {};

  // Separate primary characteristics from skills
  const primaryNames = ['Weapon Skill','Ballistic Skill','Strength','Toughness','Agility','Perception','Willpower','Fellowship','Intelligence'];
  const skillNames = Object.keys(chars).filter(k =>
    !_CHAR_STAT_NAMES.has(k) && !k.startsWith('#') && !k.startsWith('AP ')
  );

  const section = (heading, items) => {
    const h = document.createElement('div');
    h.className = 'lib-section-heading';
    h.textContent = heading;
    el.appendChild(h);
    items.forEach(name => {
      const desc = chars[name];
      if (!desc) return;
      const row = document.createElement('div');
      row.className = 'lib-def-row';
      const nm = document.createElement('div');
      nm.className = 'lib-def-name';
      nm.textContent = name;
      const d = document.createElement('div');
      d.className = 'lib-def-desc';
      d.textContent = typeof desc === 'string' ? desc : '';
      row.appendChild(nm);
      row.appendChild(_makeFavBtn({ id: 'fav_skill_' + name, label: name, sub: '', sectionId: 'skills' }));
      row.appendChild(d);
      el.appendChild(row);
    });
  };

  section('Primary Characteristics', primaryNames);
  section('Skills', skillNames.sort());
}

// ── Character Creation: Homeworlds + Origins ──────────────────────────────────

let _ccTab = 'homeworlds'; // 'homeworlds' | 'origins'

function renderCharCreationSection(el) {
  el.innerHTML = '';

  const tabBar = document.createElement('div');
  tabBar.className = 'tab-bar';
  ['homeworlds', 'origins'].forEach(tab => {
    const btn = document.createElement('button');
    btn.className = 'tab-btn' + (_ccTab === tab ? ' active' : '');
    btn.textContent = tab === 'homeworlds' ? 'Homeworlds' : 'Origins';
    btn.addEventListener('click', () => { _ccTab = tab; renderCharCreationSection(el); });
    tabBar.appendChild(btn);
  });
  el.appendChild(tabBar);

  if (_ccTab === 'homeworlds') _renderHomeworlds(el);
  else _renderOrigins(el);
}

function _statBonusRow(bonuses) {
  const wrap = document.createElement('div');
  wrap.className = 'lib-bonus-row';
  const entries = Object.entries(bonuses || {});
  if (!entries.length) return null;
  entries.forEach(([stat, val]) => {
    const chip = document.createElement('span');
    chip.className = 'lib-bonus-chip' + (val < 0 ? ' neg' : '');
    chip.textContent = (val > 0 ? '+' : '') + val + ' ' + stat;
    wrap.appendChild(chip);
  });
  return wrap;
}

function _renderHomeworlds(el) {
  const homeworlds = DATA.definitions.homeworlds || {};
  Object.entries(homeworlds).forEach(([name, hw]) => {
    const card = document.createElement('div');
    card.className = 'lib-world-card';

    const title = document.createElement('div');
    title.className = 'lib-world-title';
    title.textContent = name;
    const hwTitleRow = document.createElement('div');
    hwTitleRow.className = 'lib-world-title-row';
    hwTitleRow.appendChild(title);
    hwTitleRow.appendChild(_makeFavBtn({ id: 'fav_hw_' + name, label: name, sub: hw.description ? hw.description.slice(0,60) : '', sectionId: 'charcreate' }));
    card.appendChild(hwTitleRow);

    if (hw.description) {
      const desc = document.createElement('div');
      desc.className = 'lib-world-desc';
      desc.textContent = hw.description;
      card.appendChild(desc);
    }

    const bonusRow = _statBonusRow(hw.bonuses);
    if (bonusRow) card.appendChild(bonusRow);
    if (hw.bonus_note) {
      const note = document.createElement('div');
      note.className = 'lib-bonus-note';
      note.textContent = hw.bonus_note;
      card.appendChild(note);
    }

    if (hw.talent) {
      const talentWrap = document.createElement('div');
      talentWrap.className = 'lib-talent-row';
      const tLabel = document.createElement('span');
      tLabel.className = 'lib-talent-label';
      tLabel.textContent = 'Talent: ';
      const tName = document.createElement('span');
      tName.className = 'lib-talent-name';
      tName.textContent = hw.talent;
      talentWrap.appendChild(tLabel);
      talentWrap.appendChild(tName);
      card.appendChild(talentWrap);
      if (hw.talent_desc) {
        const td = document.createElement('div');
        td.className = 'lib-world-desc';
        td.style.marginTop = '2px';
        td.textContent = hw.talent_desc;
        card.appendChild(td);
      }
    }

    el.appendChild(card);
  });
}

function _renderOrigins(el) {
  const origins = DATA.definitions.origins || {};
  const mc = Object.entries(origins).filter(([, o]) => o.mc);
  const comp = Object.entries(origins).filter(([, o]) => !o.mc);

  const renderGroup = (heading, items) => {
    const h = document.createElement('div');
    h.className = 'lib-section-heading';
    h.textContent = heading;
    el.appendChild(h);

    items.forEach(([name, origin]) => {
      const card = document.createElement('div');
      card.className = 'lib-world-card';

      const header = document.createElement('div');
      header.className = 'lib-world-title-row';
      const title = document.createElement('span');
      title.className = 'lib-world-title';
      title.textContent = name;
      header.appendChild(title);
      if (origin.companion) {
        const ch = document.createElement('span');
        ch.className = 'lib-origin-companion';
        ch.textContent = origin.companion;
        header.appendChild(ch);
      }
      header.appendChild(_makeFavBtn({ id: 'fav_orig_' + name, label: name, sub: origin.description ? origin.description.slice(0,60) : '', sectionId: 'charcreate' }));
      card.appendChild(header);

      if (origin.description) {
        const desc = document.createElement('div');
        desc.className = 'lib-world-desc';
        desc.textContent = origin.description;
        card.appendChild(desc);
      }

      const bonusRow = _statBonusRow(origin.bonuses);
      if (bonusRow) card.appendChild(bonusRow);
      if (origin.bonus_note) {
        const note = document.createElement('div');
        note.className = 'lib-bonus-note';
        note.textContent = origin.bonus_note;
        card.appendChild(note);
      }

      if (origin.archetypes && origin.archetypes.length) {
        const arc = document.createElement('div');
        arc.className = 'lib-origin-archetypes';
        arc.textContent = 'Archetypes: ' + origin.archetypes.join(', ');
        card.appendChild(arc);
      }

      el.appendChild(card);
    });
  };

  renderGroup('MC Origins', mc);
  renderGroup('Companion Origins', comp);
}

// ── MC Builds ─────────────────────────────────────────────────────────────────

let _mcBuildSearch = '';

function renderMCBuildsSection(el) {
  el.innerHTML = '';

  const listEl = document.createElement('div');

  const search = _makeLibSearch('Search builds…', q => {
    _mcBuildSearch = q;
    _renderMCBuildList(listEl);
  });
  el.appendChild(search);
  el.appendChild(listEl);
  _renderMCBuildList(listEl);
}

function _renderMCBuildList(el) {
  el.innerHTML = '';
  const q = _mcBuildSearch.toLowerCase();

  // Group by theme
  const grouped = new Map();
  (DATA.mc_builds || []).forEach(b => {
    if (q && !b.name.toLowerCase().includes(q) && !(b.origin || '').toLowerCase().includes(q) && !(b.theme || '').toLowerCase().includes(q)) return;
    const theme = b.theme || 'Other';
    if (!grouped.has(theme)) grouped.set(theme, []);
    grouped.get(theme).push(b);
  });

  if (!grouped.size) {
    const em = document.createElement('div');
    em.className = 'gb-empty';
    em.textContent = 'No builds match.';
    el.appendChild(em);
    return;
  }

  grouped.forEach((builds, theme) => {
    const heading = document.createElement('div');
    heading.className = 'gb-group-heading';
    heading.textContent = theme + ' (' + builds.length + ')';
    el.appendChild(heading);

    builds.forEach(b => {
      const card = document.createElement('div');
      card.className = 'lib-build-card';

      const nameRow = document.createElement('div');
      nameRow.className = 'lib-build-name-row';
      const nm = document.createElement('span');
      nm.className = 'lib-build-name';
      nm.textContent = b.name;
      nameRow.appendChild(nm);
      if (b.dlc) {
        const badge = makeDlcBadge(b.dlc);
        if (badge) { badge.className = 'dlc-badge dlc-badge-pill'; nameRow.appendChild(badge); }
      }
      nameRow.appendChild(_makeFavBtn({ id: 'fav_mcbuild_' + b.name, label: b.name, sub: b.theme || '', sectionId: 'mcbuilds' }));
      card.appendChild(nameRow);

      if (b.origin) {
        const orig = document.createElement('div');
        orig.className = 'lib-build-origin';
        orig.textContent = b.origin;
        card.appendChild(orig);
      }

      // Archetype path from archetypes data
      const archs = DATA.archetypes && DATA.archetypes.mc && DATA.archetypes.mc[b.name];
      if (archs && (archs.t1 || archs.t2 || archs.t3)) {
        const path = document.createElement('div');
        path.className = 'lib-build-archetypes';
        const parts = [archs.t1, archs.t2, archs.t3].filter(Boolean);
        path.textContent = parts.join(' → ');
        card.appendChild(path);
      }

      el.appendChild(card);
    });
  });
}

// ── Retinue ───────────────────────────────────────────────────────────────────

const COMPANION_DISPLAY_ORDER = [
  'Abelard','Argenta','Cassia','Heinrix','Idira','Jae',
  'Kibellah','Marazhai','Pasqal','Solomorne','Ulfar','Yrliet',
  'Calligos Winterscale','Incendia Chorda','Uralon',
];

let _retinueSearch = '';

function renderRetinueSection(el) {
  el.innerHTML = '';

  const listEl = document.createElement('div');
  listEl.className = 'lib-retinue-list';

  const search = _makeLibSearch('Search retinue…', q => {
    _retinueSearch = q;
    _renderRetinueList(listEl);
  });
  el.appendChild(search);
  el.appendChild(listEl);
  _renderRetinueList(listEl);
}

function _renderRetinueList(el) {
  el.innerHTML = '';
  const q = _retinueSearch.toLowerCase();
  const bios = DATA.companionBios || {};
  const baseStats = DATA.companionBaseStats || {};

  const order = COMPANION_DISPLAY_ORDER.filter(name => {
    if (!q) return true;
    const bio = bios[name] || {};
    return name.toLowerCase().includes(q)
      || (bio.bio || '').toLowerCase().includes(q)
      || (bio.origin || '').toLowerCase().includes(q);
  });

  if (!order.length) {
    const em = document.createElement('div');
    em.className = 'gb-empty';
    em.textContent = 'No results.';
    el.appendChild(em);
    return;
  }

  order.forEach(name => {
    const bio = bios[name] || {};
    const stats = baseStats[name] || null;

    const card = document.createElement('div');
    card.className = 'lib-retinue-card';

    // Name + DLC badge
    const nameRow = document.createElement('div');
    nameRow.className = 'lib-retinue-name-row';
    const nm = document.createElement('span');
    nm.className = 'lib-retinue-name';
    nm.textContent = name;
    nameRow.appendChild(nm);
    if (bio.dlc) {
      const badge = makeDlcBadge(bio.dlc);
      if (badge) { badge.className = 'dlc-badge dlc-badge-pill'; nameRow.appendChild(badge); }
    }
    nameRow.appendChild(_makeFavBtn({ id: 'fav_retinue_' + name, label: name, sub: bio.origin || '', sectionId: 'retinue' }));
    card.appendChild(nameRow);

    // Homeworld / Origin / Join
    const meta = document.createElement('div');
    meta.className = 'lib-retinue-meta';
    const bits = [];
    if (bio.homeworld) bits.push(bio.homeworld);
    if (bio.origin) bits.push(bio.origin);
    if (bio.join) bits.push('Joins: ' + bio.join);
    meta.textContent = bits.join(' · ');
    if (bits.length) card.appendChild(meta);

    // Bio
    if (bio.bio) {
      const bioEl = document.createElement('div');
      bioEl.className = 'lib-retinue-bio';
      bioEl.textContent = bio.bio;
      card.appendChild(bioEl);
    }

    // Base stats mini-table
    if (stats) {
      const statsWrap = document.createElement('div');
      statsWrap.className = 'lib-retinue-stats';
      const STAT_ORDER = ['WS','BS','STR','TGH','AGI','PER','FEL','INT','WILL'];
      STAT_ORDER.forEach(s => {
        if (!stats[s]) return;
        const chip = document.createElement('span');
        chip.className = 'lib-stat-chip';
        const label = document.createElement('span');
        label.className = 'lib-stat-label';
        label.textContent = s;
        const val = document.createElement('span');
        val.className = 'lib-stat-val';
        val.textContent = stats[s];
        chip.appendChild(label);
        chip.appendChild(val);
        statsWrap.appendChild(chip);
      });
      card.appendChild(statsWrap);
    }

    // Wiki link
    if (bio.wiki) {
      const link = document.createElement('a');
      link.className = 'lib-retinue-wiki';
      link.href = bio.wiki;
      link.target = '_blank';
      link.rel = 'noopener';
      link.textContent = 'Wiki →';
      card.appendChild(link);
    }

    el.appendChild(card);
  });
}

// ── Convictions ───────────────────────────────────────────────────────────────

const _CONVICTION_COLOURS = {
  Dogmatic:   { border: 'var(--gold-deep)',    bg: 'rgba(201,164,76,0.06)'  },
  Iconoclast: { border: 'var(--ink-faint)',    bg: 'rgba(232,220,196,0.04)' },
  Heretic:    { border: 'var(--blood)',        bg: 'rgba(139,26,26,0.06)'   },
};

function renderConvictionsSection(el) {
  el.innerHTML = '';
  const data = DATA.definitions.convictions || {};
  const paths = data.paths || {};

  if (data.system) {
    const intro = document.createElement('div');
    intro.className = 'conv-intro';
    intro.textContent = data.system.description;
    el.appendChild(intro);
    if (data.system.note) {
      const note = document.createElement('div');
      note.className = 'conv-intro-note';
      note.textContent = data.system.note;
      el.appendChild(note);
    }
  }

  Object.entries(paths).forEach(([pathName, path]) => {
    const colours = _CONVICTION_COLOURS[pathName] || {};

    const card = document.createElement('div');
    card.className = 'conv-card';
    card.style.borderColor = colours.border || 'var(--rule)';
    card.style.background = colours.bg || 'var(--bg-2)';

    // Header
    const header = document.createElement('div');
    header.className = 'conv-header';
    const icon = document.createElement('span');
    icon.className = 'conv-icon';
    icon.style.color = colours.border || 'var(--gold)';
    icon.textContent = path.icon || '◈';
    const title = document.createElement('span');
    title.className = 'conv-title';
    title.style.color = colours.border || 'var(--gold)';
    title.textContent = pathName;
    header.appendChild(icon);
    header.appendChild(title);
    header.appendChild(_makeFavBtn({ id: 'fav_conv_' + pathName, label: pathName, sub: path.approach ? path.approach.slice(0,60) : '', sectionId: 'convictions' }));
    card.appendChild(header);

    // Approach
    if (path.approach) {
      const appr = document.createElement('div');
      appr.className = 'conv-approach';
      appr.textContent = `"${path.approach}"`;
      card.appendChild(appr);
    }

    // Philosophy
    if (path.philosophy) {
      const phil = document.createElement('div');
      phil.className = 'conv-philosophy';
      phil.textContent = path.philosophy;
      card.appendChild(phil);
    }

    // Companion affinity
    if (path.companion_affinity) {
      const aff = document.createElement('div');
      aff.className = 'conv-affinity-row';
      if (path.companion_affinity.positive && path.companion_affinity.positive.length) {
        const pos = document.createElement('span');
        pos.className = 'conv-affinity-pos';
        pos.textContent = '▲ ' + path.companion_affinity.positive.join(', ');
        aff.appendChild(pos);
      }
      if (path.companion_affinity.negative && path.companion_affinity.negative.length) {
        const neg = document.createElement('span');
        neg.className = 'conv-affinity-neg';
        neg.textContent = '▼ ' + path.companion_affinity.negative.join(', ');
        aff.appendChild(neg);
      }
      card.appendChild(aff);
    }

    // Tiers
    if (path.tiers && path.tiers.length) {
      const tiersHeading = document.createElement('div');
      tiersHeading.className = 'conv-tiers-heading';
      tiersHeading.textContent = 'Conviction Tiers';
      card.appendChild(tiersHeading);

      const tiers = document.createElement('div');
      tiers.className = 'conv-tiers';
      path.tiers.forEach(tier => {
        const row = document.createElement('div');
        row.className = 'conv-tier-row';

        // Rank number + points badge
        const numWrap = document.createElement('div');
        numWrap.className = 'conv-tier-num-wrap';
        const num = document.createElement('span');
        num.className = 'conv-tier-num';
        num.style.borderColor = colours.border || 'var(--gold-deep)';
        num.textContent = tier.rank;
        numWrap.appendChild(num);
        if (tier.points) {
          const pts = document.createElement('span');
          pts.className = 'conv-tier-pts';
          pts.textContent = tier.points + ' pts';
          numWrap.appendChild(pts);
        }
        row.appendChild(numWrap);

        // Name + ability + bonus
        const body = document.createElement('div');
        body.className = 'conv-tier-body';
        const nameEl = document.createElement('div');
        nameEl.className = 'conv-tier-name';
        nameEl.textContent = tier.name;
        body.appendChild(nameEl);
        if (tier.ability) {
          const ab = document.createElement('div');
          ab.className = 'conv-tier-ability';
          ab.textContent = tier.ability;
          body.appendChild(ab);
        }
        if (tier.bonus) {
          const bn = document.createElement('div');
          bn.className = 'conv-tier-bonus';
          bn.textContent = tier.bonus;
          body.appendChild(bn);
        }
        row.appendChild(body);
        tiers.appendChild(row);
      });
      card.appendChild(tiers);
    }

    el.appendChild(card);
  });
}

// ── Romances ──────────────────────────────────────────────────────────────────

function renderRomancesSection(el) {
  el.innerHTML = '';
  const data = DATA.definitions.romances || {};

  const intro = document.createElement('div');
  intro.className = 'conv-intro';
  intro.textContent = 'Romance guides for all romanceable companions. Multiple romances can run simultaneously until Act 4 forces a choice. Argenta and Idira are not romanceable.';
  el.appendChild(intro);

  Object.entries(data).forEach(([name, r]) => {
    const card = document.createElement('div');
    card.className = 'lib-world-card romance-card';

    // Header row
    const titleRow = document.createElement('div');
    titleRow.className = 'lib-world-title-row';
    const title = document.createElement('div');
    title.className = 'lib-world-title';
    title.textContent = name;
    titleRow.appendChild(title);
    titleRow.appendChild(_makeFavBtn({ id: 'fav_romance_' + name, label: name + ' Romance', sub: r.available_to || '', sectionId: 'romances' }));
    if (r.dlc) {
      const badge = makeDlcBadge(r.dlc);
      if (badge) { badge.className = 'dlc-badge dlc-badge-pill'; titleRow.appendChild(badge); }
    }
    card.appendChild(titleRow);

    // Meta chips
    const meta = document.createElement('div');
    meta.className = 'romance-meta';
    if (r.available_to) {
      const g = document.createElement('span');
      g.className = 'romance-chip';
      g.textContent = r.available_to;
      meta.appendChild(g);
    }
    if (r.conviction) {
      const c = document.createElement('span');
      c.className = 'romance-chip conviction';
      c.textContent = r.conviction;
      meta.appendChild(c);
    }
    card.appendChild(meta);

    // Summary
    if (r.summary) {
      const sum = document.createElement('div');
      sum.className = 'lib-world-desc';
      sum.textContent = r.summary;
      card.appendChild(sum);
    }

    // Steps
    if (r.steps && r.steps.length) {
      const sh = document.createElement('div');
      sh.className = 'romance-steps-heading';
      sh.textContent = 'Key Steps';
      card.appendChild(sh);
      const steps = document.createElement('div');
      steps.className = 'romance-steps';
      r.steps.forEach(s => {
        const row = document.createElement('div');
        row.className = 'romance-step-row';
        const act = document.createElement('span');
        act.className = 'romance-act-badge';
        act.textContent = s.act != null ? `Act ${s.act}` : '—';
        const txt = document.createElement('span');
        txt.className = 'romance-step-text';
        txt.textContent = s.step;
        row.appendChild(act);
        row.appendChild(txt);
        steps.appendChild(row);
      });
      card.appendChild(steps);
    }

    // Missable
    if (r.missable && r.missable.length) {
      const mh = document.createElement('div');
      mh.className = 'romance-steps-heading missable';
      mh.textContent = '⚠ Missable / Breaks Romance';
      card.appendChild(mh);
      const mlist = document.createElement('ul');
      mlist.className = 'romance-missable-list';
      r.missable.forEach(m => {
        const li = document.createElement('li');
        li.textContent = m;
        mlist.appendChild(li);
      });
      card.appendChild(mlist);
    }

    el.appendChild(card);
  });
}
