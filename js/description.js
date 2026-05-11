// ============= DESCRIPTION SHEET =============
function openDescriptionSheet(ctx, mode) {
  // mode: 'open' (default) starts a new sheet stack; 'push' adds on top.
  const { displayName, pick, available, joinLevel } = ctx;
  const title = `Level ${level} · ${displayName}`;
  const render = () => buildDescriptionContent(ctx);
  if (mode === 'push') pushSheet(title, render);
  else openSheet(title, render);
}

function buildDescriptionContent(ctx) {
  const { displayName, pick, available, joinLevel, buildName, mc } = ctx;
  const wrap = document.createElement('div');

  const meta = document.createElement('div');
  meta.className = 'desc-context';
  if (!available) {
    meta.textContent = `${displayName} - joins at level ${joinLevel}.`;
    wrap.appendChild(meta);
    const empty = document.createElement('div');
    empty.className = 'desc-text-missing';
    empty.textContent = 'No pick yet - character not in party.';
    wrap.appendChild(empty);
    return wrap;
  }
  if (!pick || (!pick.m && !pick.e)) {
    meta.textContent = `${displayName} has no pick at this level.`;
    wrap.appendChild(meta);
    return wrap;
  }

  meta.textContent = `Picks for ${displayName} at level ${level}`;
  wrap.appendChild(meta);

  const renderPickBlock = (rawPick, isExtra) => {
    if (!rawPick) return;
    // Slash pick → choice selector
    if (rawPick.includes('/')) {
      renderChoiceSection(rawPick, displayName, level, wrap, isExtra);
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
      txt.textContent = 'No description available in the source data.';
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
      const badge = makeDlcBadge(hit.dlc);
      if (badge) block.appendChild(badge);
      block.appendChild(txt);
      wrap.appendChild(block);
    });
  };

  if (pick.m) renderPickBlock(pick.m, false);
  if (pick.e) renderPickBlock(pick.e, true);

  // Archetype callout at L16 / L36
  const callout = archetypeCalloutAtLevel(level, buildName, !mc);
  if (callout) {
    const ac = document.createElement('div');
    ac.className = 'char-archetype-callout';
    ac.style.marginTop = '14px';
    ac.innerHTML = `<span class="ac-tag">Tier&nbsp;${callout.tier}&nbsp;archetype</span> <span class="ac-name">${callout.archetype}</span>`;
    wrap.appendChild(ac);
  }

  return wrap;
}
