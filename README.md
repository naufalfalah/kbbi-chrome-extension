# KBBI Chrome Extension

Chrome extension (Manifest V3) to look up Indonesian word definitions from the official [KBBI VI Daring](https://kbbi.kemendikdasmen.go.id) — Kementerian Pendidikan Dasar dan Menengah.

## Features

- **Popup search** — click the toolbar icon, type or paste a word, press Enter
- **Context menu** — select any word on a page → right-click → "Cari '[word]' di KBBI" → opens a full results tab
- Displays numbered definitions, grammar labels (v, n, ki, pb, Ark, Tas, …), and usage examples
- "Lihat di KBBI VI Daring" source link on every result
- Color scheme matches the official KBBI VI site (navy #292261 → red gradient, gold K)

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
│   ├── icon16.png      # Extracted from kbbi.kemendikdasmen.go.id favicon
│   ├── icon48.png      # (upscaled from 16px)
│   └── icon128.png     # (upscaled from 48px)
│
└── generate-icons.js   # Node script to regenerate icons (fallback, run once)
```

## Architecture

### Data flow — popup

```
popup.html
  └── popup.js  →  kbbi.js (searchKBBI)  →  fetch https://kbbi.kemendikdasmen.go.id/entri/{word}
                       └── parseKBBI()
                             ├── detect "Entri tidak ditemukan" → found: false
                             └── parse h2 + ol/ul → entries[]
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

The site renders definitions as plain server-side HTML. There is no JSON data container (unlike the old kbbi.web.id).

**URL:** `GET https://kbbi.kemendikdasmen.go.id/entri/{word}`

**Page structure:**

```html
<h2 style="margin-bottom:3px">ma.kan<sup>1</sup></h2>

<ol>
  <li>
    <font color="red"><i>
      <span title="Verba: kata kerja">v</span>
      <span title="kiasan"><font color="green">ki</font></span>
    </i></font>
    definition text:
    <font color="grey"><i>usage example</i></font>
    <font color="brown"><i>(clarification gloss)</i></font>
  </li>
</ol>

<ul class="adjusted-par">  <!-- derived/secondary entries -->
  <li>...</li>
</ul>
```

**Not found:** `<h4 style="color:red">Entri tidak ditemukan.</h4>`

**Parsing strategy:**
1. Find all `<h2>` elements with a `<sup>` child or `margin-bottom` style → one entry per h2
2. For each h2, walk forward siblings collecting `<ol>` and `<ul>` elements until the next entry h2
3. For each `<li>`:
   - Grammar labels: `<span>` inside `font[color="red"] i`
   - Usage-type labels (ki, pb, etc.): `font[color="green"]`
   - Examples: `font[color="grey"] i`
   - Brown gloss: `font[color="brown"] i` — appended to examples in parentheses
   - Definition text: remaining text after removing all `<font>` elements

### Rendering (`render.js`)

`renderResults(data, container, word)` is the single entry point. `data` shape:

```js
{
  found: boolean,
  entries: [
    {
      word: string,           // e.g. "ma.kan¹"
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
  suggestions: string[]       // always [] for this source (no suggestions provided)
}
```

`onSuggestionClick(word)` must be defined in the page's own JS (popup.js / results.js).

## Permissions

| Permission        | Why                                                      |
|-------------------|----------------------------------------------------------|
| `contextMenus`    | Register right-click "Cari di KBBI" item                 |
| `tabs`            | Open results.html in a new tab                           |
| `host_permissions: https://kbbi.kemendikdasmen.go.id/*` | Bypass CORS to fetch definitions |

## Icons

Icons were extracted from the official KBBI VI Daring favicon (`/kbbi-daring-3.ico`) using Pillow:

```bash
python3 -c "
from PIL import Image
ico = Image.open('kbbi-daring-3.ico')
ico.size = (16,16); ico.convert('RGBA').save('icons/icon16.png')
ico.size = (48,48); ico.convert('RGBA').save('icons/icon48.png')
img128 = ico.convert('RGBA').resize((128,128), Image.LANCZOS)
img128.save('icons/icon128.png')
"
```

The icon is a gold "K" on dark navy (#292261) background — matching the KBBI VI Daring brand.

## Known limitations & future work

- **Multi-word phrases** — `/entri/{word}` only handles single words. The site has a `/Cari/Hasil?frasa={query}` endpoint for phrases; could be added as a fallback.
- **Login-only content** — etymology and some extended info only appear for registered users; the extension shows the publicly available subset.
- **No suggestions** — when a word is not found, kbbi.kemendikdasmen.go.id does not return similar-word suggestions (unlike the old kbbi.web.id).
- **Offline/cache** — no caching; every lookup is a live fetch.

## Potential improvements

- Phrase search via `/Cari/Hasil?frasa=` when direct `/entri/` returns not found
- Search history (`chrome.storage.local`)
- Keyboard shortcut (`commands` API) to open popup with selected text pre-filled
- Side panel mode (Chrome 114+ `sidePanel` API) instead of new tab for context menu
- Dark mode (`prefers-color-scheme`)
