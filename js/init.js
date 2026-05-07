// ── Google Analytics ──
const KEY_CLIENT_UUID = 'rt.client-uuid.v1';
function getOrCreateUUID() {
  let id = Store.get(KEY_CLIENT_UUID);
  if (!id) {
    id = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
          const r = Math.random() * 16 | 0;
          return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });
    Store.set(KEY_CLIENT_UUID, id);
  }
  return id;
}
if (typeof gtag === 'function') {
  const uuid = getOrCreateUUID();
  const rtName = getMCName() || 'Unknown';
  gtag('config', 'G-H6KCF4RNBT', {
    user_id: uuid,
    custom_map: { dimension1: 'rogue_trader_name' },
  });
  gtag('event', 'app_open', {
    rogue_trader_name: rtName,
    user_id: uuid,
    app_version: 'v17',
  });
}

// Dismiss splash after app is ready
requestAnimationFrame(() => {
  const splash = document.getElementById('splash');
  if (splash) {
    splash.classList.add('fade-out');
    splash.addEventListener('transitionend', () => splash.remove(), { once: true });
  }
});

// ── Keyboard / visualViewport handling (iOS: keyboard pushes content) ──
if (window.visualViewport) {
  const sheet = document.getElementById('sheet');
  const resetSheet = () => {
    sheet.style.bottom = '';
    sheet.style.height = '';
    sheet.style.maxHeight = '';
    sheet.classList.remove('keyboard-open');
  };
  const onVVChange = () => {
    if (!sheet.classList.contains('open')) return;
    const vv = window.visualViewport;
    // keyboard height = gap between bottom of visual viewport and bottom of layout viewport
    const keyboardH = Math.max(0, window.innerHeight - (vv.offsetTop + vv.height));
    if (keyboardH > 50) {
      // Pin sheet exactly above keyboard; set explicit height = visible area
      // CSS flex handles internal distribution — no JS component measurement needed
      sheet.style.bottom    = keyboardH + 'px';
      sheet.style.height    = vv.height + 'px';
      sheet.style.maxHeight = vv.height + 'px';
      sheet.classList.add('keyboard-open');
    } else {
      resetSheet();
    }
  };
  window.visualViewport.addEventListener('resize', onVVChange);
  window.visualViewport.addEventListener('scroll', onVVChange);
  document.getElementById('sheet-overlay').addEventListener('click', resetSheet);
  document.getElementById('sheet-close').addEventListener('click', resetSheet);
}

// ── SW update badge ──
(() => {
  // Inject badge + toast into DOM
  const badge = document.createElement('button');
  badge.id = 'update-badge';
  badge.className = 'update-badge hidden';
  badge.setAttribute('aria-label', 'App update available');
  badge.innerHTML = '⟳';

  const toast = document.createElement('div');
  toast.id = 'update-toast';
  toast.className = 'update-toast hidden';
  toast.innerHTML = `
    <div class="update-toast-text">Update ready — close and reload to apply changes.</div>
    <button class="update-toast-reload" id="update-reload-btn">Reload Now</button>`;

  document.body.append(badge, toast);

  const showBadge = () => badge.classList.remove('hidden');

  badge.addEventListener('click', () => toast.classList.toggle('hidden'));
  document.getElementById('update-reload-btn').addEventListener('click', () => window.location.reload());

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').then(reg => {
        // Already a new SW waiting (e.g. page refreshed after update downloaded)
        if (reg.waiting && navigator.serviceWorker.controller) showBadge();

        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              showBadge();
            }
          });
        });
      }).catch(err => console.warn('SW registration failed:', err));
    });
  }
})();

// ── About ──
(() => {
  const el = document.getElementById('app-about');
  if (el && typeof APP_VERSION !== 'undefined') {
    el.innerHTML = `<span class="app-about-version">v${APP_VERSION}</span><span class="app-about-sep">·</span><a class="app-about-link" href="https://github.com/lilmuckers/rogue-trader-level-tool" target="_blank" rel="noopener">GitHub</a>`;
  }
})();
