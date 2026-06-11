# KBBI — Kamus Besar Bahasa Indonesia

<!-- Add Chrome Web Store badge here once published -->
![Version](https://img.shields.io/badge/version-1.0.0-blue)
![Manifest](https://img.shields.io/badge/manifest-v3-brightgreen)
![License](https://img.shields.io/badge/license-MIT-lightgrey)

> Look up any Indonesian word in the official KBBI VI Daring dictionary — directly from your browser toolbar or by right-clicking any word on any page.

## Overview

Reading Indonesian text online and hitting an unfamiliar word means opening a new tab, navigating to kbbi.kemendikdasmen.go.id, and typing the word out again. This extension removes that detour entirely. Select a word and right-click, or open the toolbar popup and type — definitions from the authoritative Ministry of Education dictionary (KBBI VI Daring) appear in seconds, complete with grammar class labels, register labels, and usage examples, without leaving the page you were reading.

The extension fetches data directly from the official government source at `kbbi.kemendikdasmen.go.id`, so definitions are always current and authoritative — the same content as the website, just surfaced where you already are.

## Features

- **Popup lookup** — click the toolbar icon, type or paste a word, press Enter; results appear inline in the 380px popup
- **Right-click lookup** — select any word on any webpage, right-click, choose "Cari '[word]' di KBBI" to open a full-width results tab
- **Homonym-aware display** — shows all homonyms as separate numbered cards (e.g., _makan¹_, _makan²_)
- **Structured definitions** — numbered definitions with grammar labels (`v`, `n`, `a`) and register labels (`ki`, `pb`, `Ark`, `Tas`) displayed as styled chips
- **Usage examples** — italicised example sentences and parenthetical glosses shown beneath each definition
- **Live source link** — every result card links back to the full KBBI VI Daring entry for deeper reading
- **URL-driven results page** — the full-page view updates the browser URL on each search, making results bookmarkable and shareable

## Installation

### From Chrome Web Store

<!-- Add Chrome Web Store link here -->

### Manual Installation (Developer Mode)

1. Clone or download this repository
   ```bash
   git clone https://github.com/naufalfallah/kbbi-chrome-extension.git
   ```
2. Open `chrome://extensions` in Chrome
3. Enable **Developer mode** (toggle in the top-right corner)
4. Click **Load unpacked**
5. Select the `kbbi-chrome-extension` folder

No build step. No `npm install`. The extension is ready immediately.

## How It Works

This is a **Manifest V3** extension with three active components: a **toolbar popup**, a **full-page results view**, and a **background service worker**.

The popup (`popup.html` + `popup.js`) and results page (`results.html` + `results.js`) share two modules — `kbbi.js` (network + parsing) and `render.js` (DOM rendering) — loaded via plain `<script src>` tags. There is no message passing between them; each page runs the full pipeline independently.

**Data flow — popup:**
```
User types word → popup.js → searchKBBI() in kbbi.js
  → fetch https://kbbi.kemendikdasmen.go.id/entri/{word}
  → parseKBBI() walks server-rendered HTML with DOMParser
  → render.js writes structured DOM into #results
```

**Data flow — context menu:**
```
User selects text → right-click → "Cari … di KBBI"
  → background.js (MV3 service worker, contextMenus.onClicked)
  → chrome.tabs.create({ url: results.html?word=encodeURIComponent(word) })
  → results.js reads ?word= on DOMContentLoaded → same pipeline as popup
```

The parser (`kbbi.js`) works against server-rendered HTML because the KBBI VI Daring site exposes no JSON API. It uses `DOMParser` to build an in-memory document, then locates entry headings via `<h2>` elements that carry a `<sup>` child (homonym number) or a `margin-bottom` inline style. For each heading it walks forward siblings, collecting `<ol>` and `<ul>` definition lists until hitting the next entry heading or an `<hr>`. Each `<li>` is parsed by colour-coded `<font>` element convention: red = grammar class labels, green = register labels, grey = usage examples, brown = parenthetical glosses.

The results page also uses `window.history.replaceState` to update `?word=` on every new search — so navigating back or copying the URL always reflects the current result.

## Permissions

**`contextMenus`** — required to register the "Cari … di KBBI" item in the browser's right-click menu and listen for clicks on it.

**`host_permissions: https://kbbi.kemendikdasmen.go.id/*`** — the extension pages (`popup.html`, `results.html`) are Chrome extension origins (`chrome-extension://…`). Without this host permission, the browser's CORS policy would block the cross-origin `fetch()` to the KBBI server. This permission grants fetch access only to that specific domain — no other site is touched.

The extension does not request `storage`, `scripting`, `tabs`, `activeTab`, or any other permission. It cannot read, modify, or inject content into the pages you visit.

## Technical Architecture

**Decision:** Manifest V3 with a service worker, not a persistent background page.  
**Why:** MV3 is required for all new Chrome Web Store submissions as of 2024 and is the only supported path for new extensions.  
**Trade-off:** MV3 service workers are event-driven and terminate when idle. Context menu items registered via `chrome.contextMenus.create` persist across service worker restarts because Chrome stores them, so `onInstalled` re-registration on startup is not needed beyond the initial install. If the extension ever needs per-session in-memory state, it would have to migrate to `chrome.storage.session`.

---

**Decision:** No bundler, no build step — plain HTML/CSS/JS.  
**Why:** The extension has two pages and three shared modules, all loaded with `<script src>` tags. A bundler would add toolchain complexity with no material benefit at this scale, and would require contributors to install Node just to load the extension.  
**Trade-off:** No tree-shaking, no TypeScript, no minification. Acceptable at this codebase size; revisit if the module count grows substantially.

---

**Decision:** `chrome.tabs.create` (new tab) for context menu results, not a popup or side panel.  
**Why:** MV3 service workers cannot programmatically open the extension popup — there is no API for it. A side panel (`sidePanel` API, Chrome 114+) would be a better UX but would raise the minimum Chrome version requirement and add an additional permission.  
**Trade-off:** Context menu lookups open a new tab, which is more disruptive than a side panel. The full-page layout compensates by providing a richer search experience with a larger results area.

---

**Decision:** HTML scraping via `DOMParser` rather than a JSON API.  
**Why:** kbbi.kemendikdasmen.go.id renders definitions as server-side HTML with no public JSON endpoint. `DOMParser` runs entirely in the extension page's renderer — no headless browser, no third-party proxy.  
**Trade-off:** Tightly coupled to the site's markup conventions (`font[color="red"]`, `h2[style*="margin-bottom"]`). A server-side change to the KBBI markup would break the parser. The parsing heuristics are isolated to `parseKBBI()` and `parseLi()` in `kbbi.js`, making updates surgical.

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
- Python 3 + Pillow (only if regenerating icons)

### Setup

```bash
git clone https://github.com/naufalfallah/kbbi-chrome-extension.git
cd kbbi-chrome-extension
# Load unpacked in chrome://extensions — see Installation above
```

Changes to any file take effect after clicking the reload icon (↺) on the extension card in `chrome://extensions`. Changes to `background.js` also require clicking **Update** or reloading the service worker from the extension card.

### Project Structure

```
kbbi-chrome-extension/
│
├── manifest.json        # MV3 manifest — permissions, icons, popup, service worker
├── background.js        # Service worker — registers and handles the context menu
│
├── kbbi.js              # searchKBBI(word) — fetch + HTML parse, no DOM side effects
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
└── generate-icons.js    # Node script to regenerate icons from the .ico file
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

There is no build step. To produce the `.zip` for store submission:

```bash
zip -r kbbi-extension.zip . \
  --exclude "*.git*" \
  --exclude "*.DS_Store" \
  --exclude "generate-icons.js" \
  --exclude "README.md" \
  --exclude "privacy-policy.md"
```

Upload `kbbi-extension.zip` in the Chrome Web Store Developer Dashboard.

## Known Limitations

- **Single words only** — `/entri/{word}` handles one word at a time. The site has a `/Cari/Hasil?frasa=` endpoint for phrase search; could be added as a fallback when the direct entry lookup returns not found.
- **No similar-word suggestions** — kbbi.kemendikdasmen.go.id does not return spelling suggestions for unmatched queries (unlike the old kbbi.web.id).
- **Login-only content** — etymology and extended metadata are only visible to registered users on the site; the extension surfaces the publicly available subset.
- **No offline cache** — every lookup is a live network request.

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
4. Test both the popup and the context menu (right-click on selected text)
5. Open a pull request with a clear description of what changed and why

Please do not introduce npm dependencies or a bundler without discussing it in an issue first.

## Privacy

This extension does **not** collect, store, or transmit any personal data.

- The only network request it makes is `GET https://kbbi.kemendikdasmen.go.id/entri/{word}` — the word you searched for is sent to the KBBI server, the same as visiting the website directly in your browser.
- No analytics, no telemetry, no third-party services.
- No data is written to `chrome.storage` or any other persistent store.
- The extension cannot read or modify the content of any webpage you visit — it has no content scripts and no `activeTab` permission.

## License

MIT © [Naufal Falah](https://github.com/naufalfallah)
