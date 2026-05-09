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
    <div class="update-toast-text">Update ready - close and reload to apply changes.</div>
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
  if (!el || typeof APP_VERSION === 'undefined') return;

  const aboutBtn = document.createElement('button');
  aboutBtn.className = 'app-about-link';
  aboutBtn.style.background = 'none';
  aboutBtn.style.border = 'none';
  aboutBtn.style.cursor = 'pointer';
  aboutBtn.style.padding = '0';
  aboutBtn.textContent = 'About';

  aboutBtn.addEventListener('click', () => {
    openSheet('About', () => {
      const wrap = document.createElement('div');
      wrap.className = 'about-sheet';

      wrap.innerHTML = `
        <p class="about-blurb">
          This app was built by <strong>Lilmuckers</strong> as a hobby project to make building
          a min-maxed character easier when playing Warhammer 40,000: Rogue Trader.
          True to form, it ended up being a bigger distraction from actually playing the
          game than the game itself.
        </p>
        <p class="about-blurb">
          If you find it useful, great. If you're also still on your first playthrough two
          years in because you kept respeccing - you're not alone.
        </p>

        <div class="about-section-heading">Build Data</div>
        <p class="about-blurb">
          Build progression data comes from
          <a class="about-link" href="https://docs.google.com/spreadsheets/d/1rskX4sYcNm6Wqt4rtm8EQqRR4__yrEuxCEzjwoKlHOY/" target="_blank" rel="noopener">
            Revan619's community build sheet
          </a>
          - an exhaustive community resource covering optimal builds for every character
          in the game. All credit for the build theory goes there.
        </p>

        <div class="about-section-heading">Item &amp; Ability Data</div>
        <p class="about-blurb">
          Item descriptions, locations, and ability details were sourced from:
        </p>
        <ul class="about-sources">
          <li><a class="about-link" href="https://roguetrader.wh40k.wiki/" target="_blank" rel="noopener">roguetrader.wh40k.wiki</a></li>
          <li><a class="about-link" href="https://roguetrader.wiki.fextralife.com/" target="_blank" rel="noopener">Fextralife Rogue Trader Wiki</a></li>
        </ul>

        <div class="about-section-heading">Source Code</div>
        <p class="about-blurb">
          <a class="about-link" href="https://github.com/lilmuckers/rogue-trader-level-tool" target="_blank" rel="noopener">
            github.com/lilmuckers/rogue-trader-level-tool
          </a>
        </p>

        <p class="about-disclaimer">
          Warhammer 40,000: Rogue Trader is developed by Owlcat Games.
          Warhammer 40,000 is a trademark of Games Workshop Ltd.
          This app is a fan-made tool with no affiliation to either.
        </p>
      `;

      // Check for updates button (only when SW supported)
      if ('serviceWorker' in navigator) {
        const updateSection = document.createElement('div');
        updateSection.className = 'about-section-heading';
        updateSection.textContent = 'App Version';
        wrap.appendChild(updateSection);

        const updateRow = document.createElement('div');
        updateRow.className = 'about-update-row';

        const versionLabel = document.createElement('span');
        versionLabel.className = 'about-update-version';
        versionLabel.textContent = `v${APP_VERSION}`;

        const checkBtn = document.createElement('button');
        checkBtn.className = 'about-update-btn';
        checkBtn.textContent = 'Check for updates';

        const statusEl = document.createElement('span');
        statusEl.className = 'about-update-status';

        checkBtn.addEventListener('click', async () => {
          checkBtn.disabled = true;
          statusEl.textContent = 'Checking…';
          statusEl.className = 'about-update-status checking';
          try {
            const reg = await navigator.serviceWorker.getRegistration();
            if (!reg) {
              statusEl.textContent = 'No service worker registered.';
              statusEl.className = 'about-update-status error';
              checkBtn.disabled = false;
              return;
            }
            await reg.update();
            if (reg.waiting && navigator.serviceWorker.controller) {
              statusEl.textContent = 'Update ready — reload to apply.';
              statusEl.className = 'about-update-status ready';
              document.getElementById('update-badge')?.classList.remove('hidden');
            } else {
              statusEl.textContent = 'Already up to date.';
              statusEl.className = 'about-update-status ok';
            }
          } catch (e) {
            statusEl.textContent = 'Check failed.';
            statusEl.className = 'about-update-status error';
          }
          checkBtn.disabled = false;
        });

        updateRow.appendChild(versionLabel);
        updateRow.appendChild(checkBtn);
        updateRow.appendChild(statusEl);
        wrap.appendChild(updateRow);
      }

      return wrap;
    });
  });

  el.innerHTML = `<span class="app-about-version">v${APP_VERSION}</span><span class="app-about-sep">·</span>`;
  el.appendChild(aboutBtn);
})();
