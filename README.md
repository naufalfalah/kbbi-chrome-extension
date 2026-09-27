# KBBI — Kamus Besar Bahasa Indonesia

![Version](https://img.shields.io/badge/version-1.0.1-blue)
![Manifest](https://img.shields.io/badge/manifest-v3-brightgreen)
![License](https://img.shields.io/badge/license-MIT-lightgrey)

> Look up any Indonesian word in the KBBI dictionary — directly from your browser toolbar or by right-clicking any word on any page.

## Overview

Reading Indonesian text online and hitting an unfamiliar word means opening a new tab, navigating to a KBBI site, and typing the word out again. This extension removes that detour entirely. Select a word and right-click, or open the toolbar popup and type — definitions appear in seconds, complete with grammar class labels, register labels, and usage examples, without leaving the page you were reading.

The extension fetches data directly from a KBBI source over HTTPS — no proxy, no bundled/offline dataset. Two sources are supported, switchable by the developer in `kbbi.js` (see [Data sources](#data-sources) below): the official Ministry of Education site (`kbbi.kemendikdasmen.go.id`, KBBI VI Daring) and a community-run mirror (`kbbi.web.id`, based on KBBI III). **The active source is currently `kbbi.web.id`**, because `kbbi.kemendikdasmen.go.id` has been blocking anonymous requests since August 2026 — see [Data sources](#data-sources) for details and how to switch back.

## Features

- **Popup lookup** — click the toolbar icon, type or paste a word, press Enter; results appear inline in the 380px popup
- **Right-click lookup** — select any word on any webpage, right-click, choose "Cari '[word]' di KBBI" to open a full-width results tab
- **Homonym-aware display** — shows all homonyms as separate numbered cards (e.g., _makan¹_, _makan²_)
- **Structured definitions** — numbered definitions with grammar labels (`v`, `n`, `a`) and register labels (`ki`, `pb`, `Ark`, `Tas`) displayed as styled chips
- **Usage examples** — italicised example sentences and parenthetical glosses shown beneath each definition
- **Live source link** — every result card links back to the full entry on whichever site the definitions were fetched from
- **URL-driven results page** — the full-page view updates the browser URL on each search, making results bookmarkable and shareable

## Installation

### From Chrome Web Store

[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/nojbogkoambcgcjpeokebfpdnpbcnjbm?label=chrome%20web%20store)](https://chromewebstore.google.com/detail/nojbogkoambcgcjpeokebfpdnpbcnjbm)

**[→ Install from the Chrome Web Store](https://chromewebstore.google.com/detail/nojbogkoambcgcjpeokebfpdnpbcnjbm)**

Published April 2026 · Manifest V3 · 27 KB · No data collected

### Manual Installation (Developer Mode)

1. Clone or download this repository
   ```bash
   git clone https://github.com/naufalfalah/kbbi-chrome-extension.git
   ```
2. Open `chrome://extensions` in Chrome
3. Enable **Developer mode** (toggle in the top-right corner)
4. Click **Load unpacked**
5. Select the `kbbi-chrome-extension` folder

No build step. No `npm install`. The extension is ready immediately.

## How It Works

This is a **Manifest V3** extension with three active components: a **toolbar popup**, a **full-page results view**, and a **background service worker**.

The popup (`popup.html` + `popup.js`) and results page (`results.html` + `results.js`) share the same modules, loaded in order via plain `<script src>` tags: `parsers/kemendikdasmen.js`, `parsers/kbbiwebid.js`, `kbbi.js` (a thin dispatcher over whichever parser is active), and `render.js` (DOM rendering). There is no message passing between the two pages; each runs the full pipeline independently.

**Data flow — popup:**
```
User types word → popup.js → searchKBBI() in kbbi.js
  → kbbi.js looks up ACTIVE_SOURCE in the parsers/ registry
  → fetch <active source's URL for word>
  → that source's parse(html) walks the response with DOMParser
  → render.js writes structured DOM into #results
```

**Data flow — context menu:**
```
User selects text → right-click → "Cari … di KBBI"
  → background.js (MV3 service worker, contextMenus.onClicked)
  → chrome.tabs.create({ url: results.html?word=encodeURIComponent(word) })
  → results.js reads ?word= on DOMContentLoaded → same pipeline as popup
```

Both KBBI sources render definitions as server-side HTML with no public JSON API, so both parsers work the same general way: fetch, then use `DOMParser` to build an in-memory document and walk it. The actual markup conventions are unrelated between the two sites — see [Data sources](#data-sources) for how each one is parsed.

The results page also uses `window.history.replaceState` to update `?word=` on every new search — so navigating back or copying the URL always reflects the current result.

## Data sources

The extension supports two KBBI sources. Only one is active at a time, chosen by a single developer-edited constant — there is no in-popup source picker, and no permission is used to persist a user choice.

| | `kbbi.kemendikdasmen.go.id` | `kbbi.web.id` |
|---|---|---|
| Status | Official, Ministry of Education (Kemendikdasmen) | Unofficial community mirror |
| Edition | KBBI VI Daring | Based on KBBI III (older) |
| Parser | `parsers/kemendikdasmen.js` | `parsers/kbbiwebid.js` |
| URL pattern | `/entri/{word}`, homonyms share one page | `/{word}`, each homonym is its own page (`/makan`, `/makan-2`, …) |

**Currently active: `kbbi.web.id`.** As of August 2026, `kbbi.kemendikdasmen.go.id` started blocking anonymous requests with a "Moda Terbatas" login-wall page instead of returning results, which made the extension appear to return "not found" for every word. `kbbi.web.id` doesn't have this restriction, so it's the active source until the official site's access policy changes.

**To switch sources**, edit `ACTIVE_SOURCE` in `kbbi.js` (currently set to `'kbbiwebid'`):
```js
const ACTIVE_SOURCE = 'kemendikdasmen'; // 'kemendikdasmen' | 'kbbiwebid'
```
then reload the unpacked extension (or ship a new version). Both parsers return the identical `searchKBBI` result shape, so no other file needs to change. `host_permissions` in `manifest.json` already grants both domains, so switching never requires a new Chrome Web Store permission review.

## Permissions

**`contextMenus`** — required to register the "Cari … di KBBI" item in the browser's right-click menu and listen for clicks on it. `background.js` also calls `chrome.tabs.create` to open the results tab from that menu, which does not itself require the `tabs` permission in MV3 (only reading other tabs' URLs/titles would).

**`host_permissions`** — `https://kbbi.kemendikdasmen.go.id/*` and `https://kbbi.web.id/*`. The extension pages (`popup.html`, `results.html`) are Chrome extension origins (`chrome-extension://…`). Without these host permissions, the browser's CORS policy would block the cross-origin `fetch()` to whichever KBBI source is active. Both domains are granted upfront (see [Data sources](#data-sources)) so switching sources never needs a new permission review — no other site is touched.

The extension does not request `storage`, `scripting`, `tabs`, `activeTab`, or any other permission. It cannot read, modify, or inject content into the pages you visit.

## Technical Architecture

**Decision:** Manifest V3 with a service worker, not a persistent background page.  
**Why:** MV3 is required for all new Chrome Web Store submissions as of 2024 and is the only supported path for new extensions.  
**Trade-off:** MV3 service workers are event-driven and terminate when idle. Context menu items registered via `chrome.contextMenus.create` persist across service worker restarts because Chrome stores them, so `onInstalled` re-registration on startup is not needed beyond the initial install. If the extension ever needs per-session in-memory state, it would have to migrate to `chrome.storage.session`.

---

**Decision:** No bundler, no build step — plain HTML/CSS/JS.  
**Why:** The extension has two pages and four shared scripts (two parsers, the `kbbi.js` dispatcher, and `render.js`), all loaded with `<script src>` tags. A bundler would add toolchain complexity with no material benefit at this scale, and would require contributors to install Node just to load the extension.  
**Trade-off:** No tree-shaking, no TypeScript, no minification. Acceptable at this codebase size; revisit if the module count grows substantially.

---

**Decision:** `chrome.tabs.create` (new tab) for context menu results, not a popup or side panel.  
**Why:** MV3 service workers cannot programmatically open the extension popup — there is no API for it. A side panel (`sidePanel` API, Chrome 114+) would be a better UX but would raise the minimum Chrome version requirement and add an additional permission.  
**Trade-off:** Context menu lookups open a new tab, which is more disruptive than a side panel. The full-page layout compensates by providing a richer search experience with a larger results area.

---

**Decision:** HTML scraping via `DOMParser` rather than a JSON API.  
**Why:** Neither KBBI source exposes a public JSON endpoint — both render definitions as server-side HTML. `DOMParser` runs entirely in the extension page's renderer — no headless browser, no third-party proxy.  
**Trade-off:** Tightly coupled to each site's markup conventions — `kbbi.kemendikdasmen.go.id` via colour-coded `<font>` elements, `kbbi.web.id` via a flat `<div>` with digit-vs-text `<b>` tags (see [Data sources](#data-sources)). A server-side markup change on either site would break that site's parser. Each source's parsing logic is isolated in its own file under `parsers/`, so a fix is scoped to one file and one source stays available while the other is being fixed.

---

**Decision:** Two KBBI sources behind a dispatcher, switched by a code constant rather than a settings UI.  
**Why:** Either source can go down or block anonymous access without notice — the official site already did in August 2026 (see [Data sources](#data-sources)); having a second parser ready to go means a source outage is a one-line, no-permission-review fix (`ACTIVE_SOURCE` in `kbbi.js`) instead of an emergency parser rewrite.  
**Trade-off:** Switching requires shipping a new extension version — there's no way for an end user to pick a source themselves. That's deliberate for now: a user-facing picker would need the `storage` permission and UI design work that hasn't been justified yet by actual need.

---

**Decision:** `render.js` depends on a page-defined `onSuggestionClick` callback rather than importing it.  
**Why:** `render.js` is shared between two pages that handle suggestion clicks differently (popup fills the input and re-searches in place; results page also updates the URL). Rather than branching inside `render.js` or using `postMessage`, each page simply declares the function before the shared script runs.  
**Trade-off:** Implicit contract — if a new page loads `render.js` without defining `onSuggestionClick`, suggestion buttons silently do nothing (the call is guarded by `typeof onSuggestionClick === 'function'`).

## Browser Compatibility

| Browser | Support |
|---------|---------|
| Chrome 109+ | Full support (MV3 service worker, `DOMParser`, `contextMenus`) |
| Edge 109+ | Full support (Chromium-based, same extension APIs) |
| Firefox | Not supported (uses different extension APIs; MV3 support is partial) |
| Safari | Not supported |

## Development

### Prerequisites

- Chrome 109 or later
- A text editor
- Node.js 20+ (only for running tests and building the store package — not needed to load the extension)
- Python 3 + Pillow (only if regenerating icons)

### Setup

```bash
git clone https://github.com/naufalfalah/kbbi-chrome-extension.git
cd kbbi-chrome-extension
# Load unpacked in chrome://extensions — see Installation above

npm install   # optional: only needed for tests / packaging
npm test      # parser tests (node:test + jsdom), also run in CI
```

Changes to any file take effect after clicking the reload icon (↺) on the extension card in `chrome://extensions`. Changes to `background.js` also require clicking **Update** or reloading the service worker from the extension card.

### Project Structure

```
kbbi-chrome-extension/
│
├── manifest.json        # MV3 manifest — permissions, icons, popup, service worker
├── background.js        # Service worker — registers and handles the context menu
│
├── kbbi.js              # searchKBBI(word) — dispatcher: picks ACTIVE_SOURCE, fetches, delegates parsing
├── parsers/
│   ├── kemendikdasmen.js  # URL builder + parser for kbbi.kemendikdasmen.go.id
│   └── kbbiwebid.js       # URL builder + parser for kbbi.web.id
├── render.js            # renderResults / renderLoading / renderError — DOM only
├── shared.css           # All styles — linked by both popup.html and results.html
│
├── popup.html           # Toolbar popup (380 px wide)
├── popup.js             # Popup controller; defines onSuggestionClick
│
├── results.html         # Full-page results tab (opened by context menu)
├── results.js           # Results controller; defines onSuggestionClick, updates URL
│
├── icons/
│   ├── icon16.png       # Toolbar icon (16 × 16)
│   ├── icon48.png       # Extension management page icon (48 × 48)
│   └── icon128.png      # Chrome Web Store icon (128 × 128)
│
│  ── dev-only (not shipped in the store package) ──
├── scripts/pack.sh      # Builds the Chrome Web Store .zip (npm run package)
├── test/                # node:test + jsdom parser tests and saved HTML fixtures per source
├── docs/adr/            # Architecture Decision Records
├── .github/workflows/   # CI: manifest validation, JS syntax check, tests, PR title lint
├── package.json         # Dev tooling only (jsdom, npm scripts)
├── generate-icons.js    # Node script to regenerate icons from the .ico file
├── CLAUDE.md            # Context notes for AI-assisted development
└── privacy-policy.md    # Privacy policy linked from the Chrome Web Store listing
```

### Regenerating Icons

Icons are extracted from the official KBBI VI Daring favicon. To regenerate:

```bash
curl -o /tmp/kbbi-daring-3.ico https://kbbi.kemendikdasmen.go.id/kbbi-daring-3.ico
python3 -c "
from PIL import Image
ico = Image.open('/tmp/kbbi-daring-3.ico')
ico.size = (16,16); ico.convert('RGBA').save('icons/icon16.png')
ico.size = (48,48); ico.convert('RGBA').save('icons/icon48.png')
img128 = ico.convert('RGBA').resize((128,128), Image.LANCZOS)
img128.save('icons/icon128.png')
"
```

### Building & Packaging for the Chrome Web Store

There is no build step — packaging just zips the runtime files:

```bash
npm run package        # or: ./scripts/pack.sh
```

This produces `kbbi-extension-v<version>.zip` in the repo root, with the version read from `manifest.json` (`*.zip` is git-ignored). The script deletes any previous zip of the same name first — `zip` only adds to an existing archive, so a file removed from the repo would otherwise linger in the package.

`scripts/pack.sh` lists the files the extension actually loads at runtime (an allow-list) rather than excluding dev files — an exclude-list drifts out of date every time a dev-only file (docs, tests, CI config) is added, and silently ships it to the store. **If you add a new runtime file** (e.g. a new `parsers/*.js` source), add it to the list in `scripts/pack.sh`.

Release checklist:

1. Bump `"version"` in `manifest.json` (and the version badge at the top of this README) — the store rejects a version that isn't higher than the live one.
2. `npm test`
3. `npm run package`, then check the contents with `unzip -l kbbi-extension-v<version>.zip`
4. Extract the zip into a temporary folder and load *that* folder via **Load unpacked** — this catches a runtime file missing from the allow-list before users do.
5. Upload the zip in the Chrome Web Store Developer Dashboard.

## Known Limitations

- **No similar-word suggestions** — `searchKBBI` always returns `suggestions: []`; neither parser currently extracts spelling suggestions for unmatched queries.
- **Single words only** — a lookup is one word at a time, matching how each source's URL pattern works (`/entri/{word}` on kbbi.kemendikdasmen.go.id, `/{word}` on kbbi.web.id).
- **No offline cache** — every lookup is a live network request.
- **`kbbi.kemendikdasmen.go.id` (standby source):** as of August 2026 this site blocks anonymous requests with a "Moda Terbatas" login wall, which is why `kbbi.web.id` is the active source (see [Data sources](#data-sources)). Etymology and extended metadata on the official site are also only visible to registered users; even once it's reachable again, the extension only surfaces the publicly available subset.
- **`kbbi.web.id` (active source):** an unofficial mirror based on KBBI III, so entries can be older or worded differently than the official KBBI VI Daring. Its markup has no structural separator between main senses, idioms, and derived word forms — the parser splits them with a best-effort heuristic (see `CLAUDE.md`), so grouping can occasionally be off for unusual entries.

## Potential Improvements

- Phrase search via `/Cari/Hasil?frasa=` as a fallback for unmatched entries
- Search history with `chrome.storage.local`
- Keyboard shortcut (`commands` API) to open the popup with selected text pre-filled
- Side panel mode (`sidePanel` API, Chrome 114+) for context menu results
- Dark mode via `prefers-color-scheme`

## Contributing

1. Fork the repository
2. Load unpacked in Chrome developer mode
3. Make your changes — no build step needed
4. Run `npm test`, then test both the popup and the context menu (right-click on selected text)
5. Open a pull request with a clear description of what changed and why

Please do not introduce runtime npm dependencies or a bundler without discussing it in an issue first (dev-only tooling in `package.json`, such as `jsdom` for tests, is fine).

## Privacy

This extension does **not** collect, store, or transmit any personal data.

- The only network request it makes is a `GET` to whichever KBBI source is active (see [Data sources](#data-sources); currently `https://kbbi.web.id/{word}`) — the word you searched for is sent to that server, the same as visiting the website directly in your browser.
- No analytics, no telemetry, no third-party services.
- No data is written to `chrome.storage` or any other persistent store.
- The extension cannot read or modify the content of any webpage you visit — it has no content scripts and no `activeTab` permission.

## License

MIT © [Naufal Falah](https://github.com/naufalfalah)
