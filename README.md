# KBBI Chrome Extension

Chrome extension (Manifest V3) to look up Indonesian word definitions from [kbbi.web.id](https://kbbi.web.id).

## Features

- **Popup search** — click the toolbar icon, type or paste a word, press Enter
- **Context menu** — select any word on a page → right-click → "Cari '[word]' di KBBI" → opens a full results tab
- Displays numbered definitions, grammar labels (v, n, ki, pb, …), and usage examples
- Clickable suggestions when a word is not found
- "Lihat di kbbi.web.id" source link on every result

## Install (development)

1. `chrome://extensions` → enable **Developer mode**
2. **Load unpacked** → select this folder

No build step. No dependencies.

## File structure

```
kbbi-chrome-extension/
│
├── manifest.json       # MV3 manifest — permissions, icons, entry points
├── background.js       # Service worker — registers & handles the context menu
│
├── kbbi.js             # Fetch + parse logic (shared by popup and results page)
├── render.js           # DOM rendering logic (shared by popup and results page)
├── shared.css          # All styles (shared by popup and results page)
│
├── popup.html          # Toolbar popup — 380px wide search UI
├── popup.js            # Popup controller
│
├── results.html        # Full-page results tab (opened from context menu)
├── results.js          # Results page controller
│
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
│
└── generate-icons.js   # Node script to regenerate PNG icons (run once)
```

## Architecture

### Data flow — popup

```
popup.html
  └── popup.js  →  kbbi.js (searchKBBI)  →  fetch https://kbbi.web.id/{word}
                       └── parseKBBI()
                             ├── primary:  parse #jsdata JSON  →  parseFromJSON()
                             └── fallback: parse HTML directly →  parseFromHTML()
                ↓
             render.js (renderResults / renderLoading / renderError)
                ↓
             popup.html #results
```

### Data flow — context menu

```
User selects text → right-click → "Cari … di KBBI"
  └── background.js (contextMenus.onClicked)
        └── chrome.tabs.create({ url: results.html?word=… })
              └── results.js  →  kbbi.js  →  render.js  (same pipeline as popup)
```

### Parser (`kbbi.js`)

kbbi.web.id embeds a JSON array in `<div id="jsdata">` that the page's own JS renders. Each element:

| Field | Type   | Description                              |
|-------|--------|------------------------------------------|
| `x`   | number | Entry type: `1` = primary, `5` = related |
| `w`   | string | Word lemma (e.g. `"makan¹"`)             |
| `d`   | string | Full definition as an HTML fragment      |
| `msg` | string | Non-empty when word is not found         |

The `d` HTML fragment structure:
```html
<b>ma·kan¹</b> <em>v</em>
<b>1</b> first definition <em>usage example</em>
<b>2</b> <span class="jk">ki</span> figurative meaning
```

`parseDefinitionHTML()` splits this by `<b>` tags that contain only digits to extract individual numbered definitions. `<em>` tags shorter than 5 all-alpha characters are treated as grammar labels; longer ones are usage examples.

If `#jsdata` is absent or unparseable, `parseFromHTML()` falls back to scanning for `<b>word·suku</b>` patterns and `<article>` / `#desc` containers.

### Rendering (`render.js`)

`renderResults(data, container, word)` is the single entry point. `data` shape:

```js
{
  found: boolean,
  entries: [
    {
      word: string,           // e.g. "ma·kan¹"
      definitions: [
        {
          type: 'definition' | 'compound',
          text: string,
          labels: string[],   // e.g. ["v", "ki"]
          examples: string[]  // usage examples
        }
      ]
    }
  ],
  suggestions: string[]       // populated when found === false
}
```

`onSuggestionClick(word)` must be defined in the page's own JS (popup.js / results.js) — render.js calls it when a suggestion chip is clicked.

## Permissions

| Permission        | Why                                          |
|-------------------|----------------------------------------------|
| `contextMenus`    | Register right-click "Cari di KBBI" item     |
| `tabs`            | Open results.html in a new tab               |
| `host_permissions: https://kbbi.web.id/*` | Bypass CORS to fetch definitions |

## Known limitations & future work

- **Multi-word phrases** — the URL scheme `kbbi.web.id/{word}` only accepts single words; phrases silently return no results.
- **Login-only entries** — some rare entries on kbbi.web.id require a registered account; the extension will show "not found" for those.
- **Icon quality** — current icons are programmatically generated pixel art. Replace `icons/icon*.png` with proper artwork and re-run `node generate-icons.js` (or drop in hand-crafted PNGs directly).
- **Offline/cache** — no caching; every lookup is a live fetch.

## Potential improvements

- Search history (use `chrome.storage.local`)
- Keyboard shortcut to open popup with selected text pre-filled (`commands` API)
- Side panel mode (Chrome 114+ `sidePanel` API) instead of new tab for context menu
- Dark mode (CSS `prefers-color-scheme`)
- Word audio pronunciation (kbbi.web.id sometimes embeds audio)
