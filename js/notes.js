// ============= NOTES =============
const KEY_NOTES = 'rt.notes.v1';

function getNotes() { return Store.get(KEY_NOTES) || []; }
function setNotes(notes) { Store.set(KEY_NOTES, notes); }
function noteTitle(content) {
  const first = (content || '').split('\n').find(l => l.trim());
  if (!first) return 'Untitled';
  return first.replace(/^#+\s*/, '').slice(0, 60) || 'Untitled';
}
function noteChecklistProgress(content) {
  const lines = (content || '').split('\n');
  const total   = lines.filter(l => /^\s*- \[[ xX]\] /.test(l)).length;
  const checked = lines.filter(l => /^\s*- \[[xX]\] /.test(l)).length;
  return total > 0 ? { total, checked } : null;
}
function noteSnippet(content) {
  const lines = (content || '').split('\n');
  let titleSkipped = false;
  const textLines = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    if (!titleSkipped) { titleSkipped = true; continue; } // skip title line
    // Stop at headings, any list item (bullets, checkboxes, numbered), dividers, code fences
    if (/^#{1,6}\s/.test(t) || /^[-*+]\s/.test(t) || /^\d+\.\s/.test(t) || /^-{3,}$/.test(t) || /^`{3}/.test(t)) break;
    textLines.push(t);
    if (textLines.join(' ').length >= 120) break;
  }
  return textLines.join(' ').replace(/[*_`~]/g, '').slice(0, 100);
}
function renderMarkdown(text, onToggleTodo) {
  if (!text) return '';
  const lines = text.split('\n');
  // Escape HTML per-line, tracking line indices for todos
  const escaped = lines.map(l => l.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'));
  let s = escaped.join('\n');
  // Headers
  s = s.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  s = s.replace(/^## (.+)$/gm,  '<h2>$1</h2>');
  s = s.replace(/^# (.+)$/gm,   '<h1>$1</h1>');
  // Bold/italic/code
  s = s.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\*(.+?)\*/g,    '<em>$1</em>');
  s = s.replace(/`(.+?)`/g,      '<code>$1</code>');
  // Horizontal rule
  s = s.replace(/^---$/gm, '<hr>');
  // Todo items (before general list so they match first)
  // We need line numbers — rebuild from per-line processing
  const processedLines = s.split('\n');
  s = processedLines.map((line, i) => {
    // Match on processed line (brackets not escaped)
    if (/^- \[x\] /i.test(line)) {
      const label = line.replace(/^- \[x\] /i, '');
      return `<li class="todo-item todo-done" data-line="${i}"><span class="todo-check">✓</span><span class="todo-label">${label}</span></li>`;
    }
    if (/^- \[ \] /.test(line)) {
      const label = line.replace(/^- \[ \] /, '');
      return `<li class="todo-item" data-line="${i}"><span class="todo-check">☐</span><span class="todo-label">${label}</span></li>`;
    }
    return line;
  }).join('\n');
  // Wrap consecutive todo items in <ul class="todo-list">
  s = s.replace(/((?:<li class="todo-item[^"]*"[^>]*>.*?<\/li>\n?)+)/g, '<ul class="todo-list">$1</ul>');
  // Regular lists: group consecutive - lines
  s = s.replace(/((?:^- .+\n?)+)/gm, (block) => {
    const items = block.split('\n').filter(l => l.startsWith('- ')).map(l => `<li>${l.slice(2)}</li>`).join('');
    return `<ul>${items}</ul>`;
  });
  // Paragraphs
  s = s.replace(/\n{2,}/g, '\n\n');
  const blocks = s.split('\n\n');
  s = blocks.map(b => {
    b = b.trim();
    if (!b) return '';
    if (/^<[hul]|^<hr/.test(b)) return b;
    return '<p>' + b.replace(/\n/g, '<br>') + '</p>';
  }).join('\n');
  return s;
}

const KEY_NOTES_SORT = 'rt.notes-sort.v1';
function getNotesSort() { return Store.get(KEY_NOTES_SORT) || 'updated'; }
function setNotesSort(v) { Store.set(KEY_NOTES_SORT, v); }

// Persistent undo history (localStorage + in-memory write-through)
// ── Undo / Redo history (persistent, per-note) ──
// Storage format: { noteId: { u: [undoStack], r: [redoStack] } }
const KEY_NOTES_HISTORY = 'rt.notes-history.v2';
const MAX_UNDO = 20;
const _historyCache = new Map(); // noteId → { u: [], r: [] }
let _historyCacheLoaded = false;

function _loadHistory() {
  if (_historyCacheLoaded) return;
  _historyCacheLoaded = true;
  const raw = Store.get(KEY_NOTES_HISTORY) || {};
  for (const [id, h] of Object.entries(raw)) _historyCache.set(id, { u: h.u || [], r: h.r || [] });
}
function _saveHistory() {
  const obj = {};
  _historyCache.forEach(({ u, r }, id) => { if (u.length || r.length) obj[id] = { u, r }; });
  Store.set(KEY_NOTES_HISTORY, obj);
}
function _getH(noteId) {
  _loadHistory();
  if (!_historyCache.has(noteId)) _historyCache.set(noteId, { u: [], r: [] });
  return _historyCache.get(noteId);
}
// Call before committing a new edit: snapshot current, clear redo (new branch)
function historyPushEdit(noteId, prevContent) {
  const h = _getH(noteId);
  if (h.u.length && h.u[h.u.length - 1] === prevContent) return; // no dup
  h.u.push(prevContent);
  if (h.u.length > MAX_UNDO) h.u.shift();
  h.r = []; // new edit prunes redo
  _saveHistory();
}
// Returns previous content (or null); caller should push current to redo
function historyUndo(noteId, currentContent) {
  const h = _getH(noteId);
  if (!h.u.length) return null;
  h.r.push(currentContent);
  if (h.r.length > MAX_UNDO) h.r.shift();
  const prev = h.u.pop();
  _saveHistory();
  return prev;
}
// Returns next content (or null); caller should push current to undo
function historyRedo(noteId, currentContent) {
  const h = _getH(noteId);
  if (!h.r.length) return null;
  h.u.push(currentContent);
  if (h.u.length > MAX_UNDO) h.u.shift();
  const next = h.r.pop();
  _saveHistory();
  return next;
}
function historyUndoLen(noteId) { return _getH(noteId).u.length; }
function historyRedoLen(noteId) { return _getH(noteId).r.length; }
// Prune history for deleted notes
function pruneHistory(activeIds) {
  _loadHistory();
  let changed = false;
  _historyCache.forEach((_, id) => { if (!activeIds.has(id)) { _historyCache.delete(id); changed = true; } });
  if (changed) _saveHistory();
}

function sortedNotes(notes, sort) {
  const active   = notes.filter(n => !n.archived);
  const archived = notes.filter(n =>  n.archived);
  const cmp = sort === 'title'   ? (a,b) => noteTitle(a.content).localeCompare(noteTitle(b.content))
            : sort === 'created' ? (a,b) => (b.createdAt||b.updatedAt||0) - (a.createdAt||a.updatedAt||0)
            :                      (a,b) => (b.updatedAt||0) - (a.updatedAt||0);
  return { active: [...active].sort(cmp), archived: [...archived].sort(cmp) };
}

function renderNotesSection() {
  const el = $('notes-content');
  el.innerHTML = '';
  const notes = getNotes();
  const sort  = getNotesSort();

  // Header row
  const headerRow = document.createElement('div');
  headerRow.className = 'notes-header-row';

  // Sort control
  const sortRow = document.createElement('div');
  sortRow.className = 'notes-sort-row';
  ['updated','created','title'].forEach(s => {
    const btn = document.createElement('button');
    btn.className = 'notes-sort-btn' + (sort === s ? ' active' : '');
    btn.textContent = s === 'updated' ? 'Last edited' : s === 'created' ? 'Created' : 'Title';
    btn.addEventListener('click', () => { setNotesSort(s); renderNotesSection(); });
    sortRow.appendChild(btn);
  });

  const addBtn = document.createElement('button');
  addBtn.className = 'notes-add-btn';
  addBtn.textContent = '＋';
  addBtn.title = 'New note';
  addBtn.addEventListener('click', () => openNoteEditor(null));
  headerRow.append(sortRow, addBtn);
  el.appendChild(headerRow);

  const { active, archived } = sortedNotes(notes, sort);

  if (!active.length && !archived.length) {
    const empty = document.createElement('div');
    empty.className = 'notes-empty';
    empty.textContent = 'No notes yet. Tap ＋ to create one.';
    el.appendChild(empty);
    return;
  }

  active.forEach(note => el.appendChild(buildNoteCard(note, false)));

  if (archived.length) {
    const archHeading = document.createElement('div');
    archHeading.className = 'notes-archive-heading';
    archHeading.textContent = `Archived (${archived.length})`;
    el.appendChild(archHeading);
    archived.forEach(note => el.appendChild(buildNoteCard(note, true)));
  }
}

function buildNoteCard(note, isArchived) {
  const outer = document.createElement('div');
  outer.className = 'note-card-outer';

  // Delete background (revealed on left-swipe for active; also archived)
  const deleteBg = document.createElement('div');
  deleteBg.className = 'note-delete-bg';
  deleteBg.textContent = 'Delete';
  outer.appendChild(deleteBg);

  const card = document.createElement('div');
  card.className = 'note-card' + (isArchived ? ' note-archived' : '');

  const title = document.createElement('div');
  title.className = 'note-card-title';
  title.textContent = noteTitle(note.content);
  const snippet = document.createElement('div');
  snippet.className = 'note-card-snippet';
  snippet.textContent = noteSnippet(note.content);
  const date = document.createElement('div');
  date.className = 'note-card-date';
  date.textContent = note.updatedAt ? new Date(note.updatedAt).toLocaleDateString() : '';
  card.append(title, snippet, date);

  const progress = noteChecklistProgress(note.content);
  if (progress) {
    const pct = progress.total ? Math.round((progress.checked / progress.total) * 100) : 0;
    const bar = document.createElement('div');
    bar.className = 'note-progress';
    bar.innerHTML = `<div class="note-progress-bar" style="width:${pct}%"></div>`;
    bar.title = `${progress.checked} of ${progress.total} tasks`;
    const label = document.createElement('span');
    label.className = 'note-progress-label';
    label.textContent = `${progress.checked}/${progress.total}`;
    const wrap = document.createElement('div');
    wrap.className = 'note-progress-wrap';
    wrap.append(bar, label);
    card.appendChild(wrap);
  }

  card.addEventListener('click', () => openNoteEditor(note));
  outer.appendChild(card);

  let startX = 0, startY = 0, dx = 0, intentDecided = false, active = false;
  const DELETE_THRESHOLD = 100;
  const ARCHIVE_THRESHOLD = 80;

  const doDelete = () => {
    card.style.transition = 'transform 0.2s, opacity 0.2s';
    card.style.transform = 'translateX(-100%)';
    card.style.opacity = '0';
    setTimeout(() => {
      const all = getNotes().filter(n => n.id !== note.id);
      setNotes(all);
      pruneHistory(new Set(all.map(n => String(n.id))));
      renderNotesSection();
    }, 200);
  };

  const reset = () => {
    card.style.transition = 'transform 0.2s';
    card.style.transform = '';
    deleteBg.classList.remove('visible');
    setTimeout(() => { card.style.transition = ''; }, 220);
    intentDecided = false; active = false; dx = 0;
  };

  card.addEventListener('touchstart', e => {
    startX = e.touches[0].clientX; startY = e.touches[0].clientY;
    dx = 0; intentDecided = false; active = false;
  }, { passive: true });

  card.addEventListener('touchmove', e => {
    dx = e.touches[0].clientX - startX;
    const dy = e.touches[0].clientY - startY;
    if (!intentDecided) {
      if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
      if (Math.abs(dy) >= Math.abs(dx)) { intentDecided = true; return; } // vertical
      intentDecided = true;
      if (dx > 0 && !isArchived) return; // right swipe on active note — ignore
      active = true;
    }
    if (!active) return;
    card.style.transition = 'none';
    if (!isArchived) {
      // Active note: left swipe → archive only (no delete from active)
      card.style.transform = `translateX(${Math.min(0, dx)}px)`;
      deleteBg.textContent = 'Archive';
      deleteBg.classList.toggle('visible', dx < -20);
    } else {
      // Archived note: left → delete, right → restore
      card.style.transform = `translateX(${dx}px)`;
      deleteBg.textContent = 'Delete';
      deleteBg.classList.toggle('visible', dx < -20);
    }
  }, { passive: true });

  card.addEventListener('touchend', () => {
    if (!active) return;
    if (!isArchived) {
      // Active: swipe left far enough → archive
      if (dx < -ARCHIVE_THRESHOLD) {
        note.archived = true;
        const all = getNotes(); const i = all.findIndex(n => n.id === note.id);
        if (i >= 0) { all[i] = note; setNotes(all); }
        renderNotesSection();
        return;
      }
    } else {
      // Archived: swipe left → delete, swipe right → restore
      if (dx < -ARCHIVE_THRESHOLD) { doDelete(); return; }
      if (dx > ARCHIVE_THRESHOLD) {
        note.archived = false;
        note.updatedAt = Date.now();
        const all = getNotes(); const i = all.findIndex(n => n.id === note.id);
        if (i >= 0) { all[i] = note; setNotes(all); }
        renderNotesSection();
        return;
      }
    }
    reset();
  });

  card.addEventListener('touchcancel', reset);
  deleteBg.addEventListener('click', () => {
    if (isArchived) doDelete();
    else {
      note.archived = true;
      const all = getNotes(); const i = all.findIndex(n => n.id === note.id);
      if (i >= 0) { all[i] = note; setNotes(all); }
      renderNotesSection();
    }
  });

  return outer;
}

function openNoteEditor(note) {
  const isNew = !note;
  if (isNew) {
    note = { id: Date.now() + Math.random(), content: '', updatedAt: Date.now(), createdAt: Date.now() };
    const notes = getNotes();
    notes.unshift(note);
    setNotes(notes);
  }
  // New notes start in edit; existing notes start in preview
  openSheet(isNew ? 'New Note' : noteTitle(note.content), () => buildNoteEditorContent(note, isNew));
}

function buildNoteEditorContent(note, startInEdit = false) {
  const wrap = document.createElement('div');
  wrap.className = 'note-editor-wrap';

  const toolbar = document.createElement('div');
  toolbar.className = 'note-toolbar';

  let previewMode = !startInEdit;

  // Floating preview/edit toggle FAB
  const previewFab = document.createElement('button');
  previewFab.className = 'note-preview-fab';

  const fmtButtons = [
    { label: 'B',  title: 'Bold',        wrap: ['**','**'] },
    { label: 'I',  title: 'Italic',      wrap: ['*','*'] },
    { label: 'H1', title: 'Heading 1',   prefix: '# ' },
    { label: 'H2', title: 'Heading 2',   prefix: '## ' },
    { label: '•',  title: 'List item',   prefix: '- ' },
    { label: '☐',  title: 'Todo item',   prefix: '- [ ] ' },
    { label: '—',  title: 'Divider',     insert: '\n---\n' },
  ];

  const textarea = document.createElement('textarea');
  textarea.className = 'note-textarea';
  textarea.value = note.content || '';
  textarea.placeholder = 'Start writing…';
  textarea.style.userSelect = 'text';
  textarea.style.webkitUserSelect = 'text';
  textarea.spellcheck = true;
  textarea.autocorrect = 'on';

  const preview = document.createElement('div');
  preview.className = 'note-preview';

  // Save indicator
  const saveIndicator = document.createElement('span');
  saveIndicator.className = 'note-save-indicator';
  let fadeTimer = null;
  const flashSaved = () => {
    saveIndicator.classList.add('visible');
    clearTimeout(fadeTimer);
    fadeTimer = setTimeout(() => saveIndicator.classList.remove('visible'), 1200);
  };

  // Undo / Redo buttons
  const undoBtn = document.createElement('button');
  undoBtn.className = 'note-tool-btn note-undo-btn';
  undoBtn.textContent = '↩';
  undoBtn.title = 'Undo';
  const redoBtn = document.createElement('button');
  redoBtn.className = 'note-tool-btn note-undo-btn';
  redoBtn.textContent = '↪';
  redoBtn.title = 'Redo';

  const updateHistoryBtns = () => {
    undoBtn.disabled = historyUndoLen(note.id) === 0;
    redoBtn.disabled = historyRedoLen(note.id) === 0;
  };
  updateHistoryBtns();

  let saveTimer = null;
  const commitSave = () => {
    note.content = textarea.value;
    note.updatedAt = Date.now();
    const notes = getNotes();
    const idx = notes.findIndex(n => n.id === note.id);
    if (idx >= 0) notes[idx] = note; else notes.unshift(note);
    setNotes(notes);
    $('sheet-title').textContent = noteTitle(note.content) || 'New Note';
    flashSaved();
    updateHistoryBtns();
    // Refresh list behind the sheet so card titles/previews stay in sync
    if (_activeSection === 'notes') renderNotesSection();
  };
  const save = () => { clearTimeout(saveTimer); saveTimer = setTimeout(commitSave, 600); };

  textarea.addEventListener('input', () => {
    // Snapshot current persisted state before new edit; clears redo (new branch)
    historyPushEdit(note.id, note.content);
    updateHistoryBtns();
    save();
  });
  textarea.addEventListener('blur', () => {
    clearTimeout(saveTimer);
    if (textarea.value !== note.content) commitSave();
  });

  // Auto-continue list / checklist on Enter; double-Enter on empty item exits list
  textarea.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.shiftKey) return;
    if (textarea.selectionStart !== textarea.selectionEnd) return; // selection → default

    const val = textarea.value;
    const pos = textarea.selectionStart;
    const lineStart = val.lastIndexOf('\n', pos - 1) + 1;
    const lineEnd   = val.indexOf('\n', pos);
    const fullLine  = val.slice(lineStart, lineEnd === -1 ? undefined : lineEnd);

    // Match: optional indent + (checkbox or bullet)
    const m = fullLine.match(/^(\s*)(- \[[ xX]\] |- |\* )/);
    if (!m) return;

    e.preventDefault();

    const indent     = m[1];
    const rawPrefix  = m[2];
    const content    = fullLine.slice(m[0].length).trim();
    // Always start new checklist items unchecked
    const newPrefix  = indent + (rawPrefix.match(/- \[/) ? '- [ ] ' : rawPrefix);

    if (content === '') {
      // Empty item — strip prefix, leave blank line (exit list)
      const newVal = val.slice(0, lineStart) + val.slice(lineStart + m[0].length);
      textarea.value = newVal;
      textarea.setSelectionRange(lineStart, lineStart);
    } else {
      // Continue list
      const insert = '\n' + newPrefix;
      const newVal = val.slice(0, pos) + insert + val.slice(pos);
      textarea.value = newVal;
      textarea.setSelectionRange(pos + insert.length, pos + insert.length);
    }

    historyPushEdit(note.id, note.content);
    save();
  });

  undoBtn.addEventListener('click', () => {
    clearTimeout(saveTimer);
    const prev = historyUndo(note.id, note.content);
    if (prev == null) return;
    textarea.value = prev;
    commitSave();
    if (previewMode) refreshPreview();
  });

  redoBtn.addEventListener('click', () => {
    clearTimeout(saveTimer);
    const next = historyRedo(note.id, note.content);
    if (next == null) return;
    textarea.value = next;
    commitSave();
    if (previewMode) refreshPreview();
  });

  const refreshPreview = () => { preview.innerHTML = renderMarkdown(textarea.value); };

  const applyMode = () => {
    const sh = document.getElementById('sheet');
    if (previewMode) {
      refreshPreview();
      preview.classList.remove('hidden');
      textarea.classList.add('hidden');
      // Hide format buttons in preview mode
      toolbar.querySelectorAll('.note-fmt-btn, .note-undo-btn').forEach(b => b.classList.add('hidden'));
      previewFab.textContent = '✎ Edit';
      previewFab.classList.add('active');
      sh.classList.remove('note-editing');
    } else {
      preview.classList.add('hidden');
      textarea.classList.remove('hidden');
      toolbar.querySelectorAll('.note-fmt-btn, .note-undo-btn').forEach(b => b.classList.remove('hidden'));
      previewFab.textContent = '👁 Preview';
      previewFab.classList.remove('active');
      sh.classList.add('note-editing');
      requestAnimationFrame(() => textarea.focus());
    }
  };

  fmtButtons.forEach(({ label, title, wrap: w, prefix, insert }) => {
    const btn = document.createElement('button');
    btn.className = 'note-tool-btn note-fmt-btn';
    btn.textContent = label;
    btn.title = title;
    btn.addEventListener('click', () => {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selected = textarea.value.slice(start, end);
      let newText, newStart, newEnd;
      if (insert) {
        newText = textarea.value.slice(0, start) + insert + textarea.value.slice(end);
        newStart = newEnd = start + insert.length;
      } else if (w) {
        const replacement = w[0] + (selected || 'text') + w[1];
        newText = textarea.value.slice(0, start) + replacement + textarea.value.slice(end);
        newStart = start + w[0].length;
        newEnd = newStart + (selected || 'text').length;
      } else if (prefix) {
        const lineStart = textarea.value.lastIndexOf('\n', start - 1) + 1;
        const lineContent = textarea.value.slice(lineStart, end);
        const already = lineContent.startsWith(prefix);
        const replacement = already ? lineContent.slice(prefix.length) : prefix + lineContent;
        newText = textarea.value.slice(0, lineStart) + replacement + textarea.value.slice(end);
        newStart = newEnd = lineStart + replacement.length;
      }
      textarea.value = newText;
      textarea.focus();
      textarea.setSelectionRange(newStart, newEnd);
      save();
    });
    toolbar.appendChild(btn);
  });

  toolbar.appendChild(undoBtn);
  toolbar.appendChild(redoBtn);
  toolbar.appendChild(saveIndicator);

  // Todo tap in preview
  preview.addEventListener('click', (e) => {
    const item = e.target.closest('.todo-item');
    if (!item) return;
    const lineIdx = parseInt(item.dataset.line, 10);
    const lines = textarea.value.split('\n');
    const line = lines[lineIdx];
    if (/^- \[x\] /i.test(line)) lines[lineIdx] = line.replace(/^- \[x\] /i, '- [ ] ');
    else if (/^- \[ \] /.test(line)) lines[lineIdx] = line.replace(/^- \[ \] /, '- [x] ');
    textarea.value = lines.join('\n');
    historyPushEdit(note.id, note.content); // snapshot before commit (clears redo)
    clearTimeout(saveTimer);
    commitSave();
    refreshPreview();
  });

  previewFab.addEventListener('click', () => {
    previewMode = !previewMode;
    applyMode();
  });

  const editorArea = document.createElement('div');
  editorArea.className = 'note-editor-area';
  editorArea.append(textarea, preview, previewFab);

  wrap.append(toolbar, editorArea);

  // Initialise mode after elements are in DOM (via requestAnimationFrame post-openSheet)
  requestAnimationFrame(applyMode);
  return wrap;
}
