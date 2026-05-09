# Rogue Trader Build Tracker

Offline-capable level companion for Warhammer 40,000: Rogue Trader, based on
[Revan619's community build sheet](https://docs.google.com/spreadsheets/d/1rskX4sYcNm6Wqt4rtm8EQqRR4__yrEuxCEzjwoKlHOY/).

Pick your Main Character build and a variant for each companion. The app then
shows you, at the level of your choice, exactly which ability/talent/stat to
take for everyone in your party — your selections persist on the device.

## Deployment to GitHub Pages

1. Create a new public GitHub repository (e.g. `rt-tracker`).
2. Copy every file in this folder into the repo root:
   - `index.html`
   - `manifest.json`
   - `sw.js`
   - `icon-16.png`, `icon-32.png`, `icon-180.png`, `icon-192.png`, `icon-512.png`, `icon-512-maskable.png`
3. Push to `main`.
4. Repository **Settings → Pages → Build and deployment**:
   - Source: **Deploy from a branch**
   - Branch: **main** / **/ (root)**
   - Save.
5. Wait ~30 seconds. Your app is live at `https://<username>.github.io/<repo>/`.

## Adding to your iPhone home screen

1. Open the GitHub Pages URL in **Safari** (not Chrome — only Safari can install PWAs on iOS).
2. Tap the **Share** button → **Add to Home Screen**.
3. Tap the new home-screen icon. The app opens fullscreen with no Safari chrome.
4. Open it once with internet. The service worker caches everything.
5. From then on, it works offline. Toggle airplane mode to verify.

## Updating

Edit any file, push, and bump `CACHE_VERSION` in `sw.js` (e.g. `rt-tracker-v1` → `rt-tracker-v2`). Existing installs will pick up the new version on next launch when online.

## Storage

Your roster + current level are stored in `localStorage` under keys
`rt.config.v1` and `rt.level.v1`. They survive app restarts and reboots.
"Reset All Data" in the setup view clears them.
