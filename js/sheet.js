// ============= BOTTOM SHEET =============
// Stack of {title, render} entries. The current view is at the top.
// Pushing adds a new view; popping returns to the previous one.
// The back button shows when stack length > 1.
let _sheetStack = [];

// Each stack entry: { title, render, node, scrollTop }
// `node` caches the rendered DOM so popping back restores exact state (tab
// selection, scroll position) without a re-render.
// Pass forceRender=true to bust the cache (e.g. after a choice is marked).
function _renderTopOfStack(forceRender = false) {
  if (_sheetStack.length === 0) return;
  const top = _sheetStack[_sheetStack.length - 1];
  $('sheet-title').textContent = top.title;
  const body = $('sheet-body');

  // Bust every entry's cache when state changes (e.g. pick choice marked)
  if (forceRender) _sheetStack.forEach(e => { e.node = null; e.scrollTop = 0; });

  if (!top.node) top.node = top.render();
  body.innerHTML = '';
  body.appendChild(top.node);
  body.scrollTop = top.scrollTop || 0;

  // Back button always hidden — X handles going back at every depth
  $('sheet-back').classList.add('hidden');
}

// Open a fresh sheet (resets the stack).
function openSheet(title, render) {
  _sheetStack = [{ title, render, node: null, scrollTop: 0 }];
  _renderTopOfStack();
  $('sheet-overlay').classList.add('open');
  $('sheet').classList.add('open');
  document.body.style.overflow = 'hidden';
}

// Push a new view. Saves the current scroll position so it's restored on pop.
function pushSheet(title, render) {
  if (_sheetStack.length > 0) {
    _sheetStack[_sheetStack.length - 1].scrollTop = $('sheet-body').scrollTop;
  }
  _sheetStack.push({ title, render, node: null, scrollTop: 0 });
  _renderTopOfStack();
}

// Pop the top view. Restores the cached DOM + scroll of the view below.
// At the bottom of the stack, closes the sheet entirely.
function popSheet() {
  if (_sheetStack.length <= 1) { closeSheet(); return; }
  _sheetStack.pop();
  _renderTopOfStack();
}

function closeSheet() {
  _sheetStack = [];
  $('sheet-overlay').classList.remove('open');
  const sh = $('sheet');
  sh.classList.remove('open');
  sh.classList.remove('note-editing');
  sh.style.height = '';
  sh.style.maxHeight = '';
  sh.style.bottom = '';
  $('sheet-back').classList.add('hidden');
  document.body.style.overflow = '';
}
// X always pops (closes sheet when at depth 1, goes back when deeper)
$('sheet-close').addEventListener('click', popSheet);
$('sheet-back').addEventListener('click', popSheet);
$('sheet-overlay').addEventListener('click', closeSheet);
// swipe-down to close (disabled when note editor is in edit mode)
(() => {
  let startY = null;
  const sheet = $('sheet');
  sheet.addEventListener('touchstart', (e) => {
    if (sheet.classList.contains('note-editing')) { startY = null; return; }
    const sb = $('sheet-body');
    if (sb.scrollTop > 0) { startY = null; return; }
    startY = e.touches[0].clientY;
  }, { passive: true });
  sheet.addEventListener('touchmove', (e) => {
    if (startY == null) return;
    const dy = e.touches[0].clientY - startY;
    if (dy > 0) sheet.style.transform = `translateY(${dy}px)`;
  }, { passive: true });
  sheet.addEventListener('touchend', (e) => {
    if (startY == null) return;
    const dy = (e.changedTouches[0].clientY - startY);
    sheet.style.transform = '';
    if (dy > 80) closeSheet();
    startY = null;
  });
})();
