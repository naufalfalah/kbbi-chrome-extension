# KBBI Chrome Extension — Claude Context

## Project overview

Manifest V3 Chrome extension that fetches Indonesian word definitions from **kbbi.kemendikdasmen.go.id** (KBBI VI Daring — official Ministry of Education source). No build step, no bundler, no npm dependencies — plain HTML/CSS/JS files loaded directly by Chrome.

## Key architectural decisions

### No build tooling
All files are plain JS/CSS/HTML. Do not introduce bundlers (Webpack, Vite, etc.) unless the user explicitly asks. Shared modules (`kbbi.js`, `render.js`, `shared.css`) are loaded via `<script src>` and `<link rel=stylesheet>` in each HTML file.

### Data source: plain server-rendered HTML
kbbi.kemendikdasmen.go.id renders definitions as standard HTML — no JSON data container. The parser reads `<h2>` headings and `<ol>/<ul>` definition lists directly.

### Shared vs page-specific files
- `kbbi.js` — fetch + parse, no DOM side effects, exports only `searchKBBI`
- `render.js` — pure rendering (`renderResults`, `renderLoading`, `renderError`). Calls `onSuggestionClick(word)` which **must be defined** in the consuming page's JS
- `shared.css` — all styles; popup.html and results.html both link this
- `popup.js` / `results.js` — page controllers; each defines `onSuggestionClick`

### Context menu opens a new tab
`background.js` opens `results.html?word=…` in a new tab. Chrome MV3 service workers cannot programmatically open the extension popup.

## File map

| File | Role |
|------|------|
| `manifest.json` | MV3 config — permissions, icons, popup, service worker |
| `background.js` | Service worker — context menu registration + handler |
| `kbbi.js` | `searchKBBI(word)` — fetch + parse kbbi.kemendikdasmen.go.id |
| `render.js` | `renderResults / renderLoading / renderError` — DOM rendering |
| `shared.css` | All CSS — used by both popup and results page |
| `popup.html` | Toolbar popup (380px wide) |
| `popup.js` | Popup controller; defines `onSuggestionClick` |
| `results.html` | Full-page results tab |
| `results.js` | Results controller; defines `onSuggestionClick`, updates URL |
| `icons/*.png` | Extracted from official KBBI VI Daring favicon (gold K on navy) |
| `generate-icons.js` | Node fallback to regenerate icons (not loaded by Chrome) |

## `searchKBBI` return shape

```js
{
  found: boolean,
  entries: Array<{
    word: string,           // e.g. "ma.kan¹"
    definitions: Array<{
      type: 'definition' | 'compound',
      text: string,
      labels: string[],     // grammar + usage labels, e.g. ["v", "ki"]
      examples: string[]    // usage examples; brown-font glosses in parentheses
    }>
  }>,
  suggestions: string[]     // always [] — site doesn't return suggestions
}
```

## Permissions in manifest.json

- `contextMenus` — right-click menu
- `tabs` — open results.html in new tab
- `host_permissions: https://kbbi.kemendikdasmen.go.id/*` — CORS bypass for fetch

Do not add `storage` or `scripting` unless a feature explicitly needs them.

## How kbbi.kemendikdasmen.go.id works (parser notes)

**URL:** `GET /entri/{word}` — case-insensitive, no URL encoding needed for ASCII words.

**Entry headings:** `<h2 style="margin-bottom:3px">word<sup>n</sup></h2>` — one h2 per homonym.

**Definition lists:** `<ol>` for main defs, `<ul class="adjusted-par">` for derived/related.

**Each `<li>` structure:**
```html
<font color="red"><i>
  <span title="Verba: kata kerja">v</span>
  <span title="kiasan"><font color="green">ki</font></span>
</i></font>
definition text:
<font color="grey"><i>usage example</i></font>
<font color="brown"><i>parenthetical gloss</i></font>
```

- Red font → grammar class labels (`v`, `n`, `a`, etc.)
- Green font → usage/register labels (`ki`, `pb`, `Ark`, `Tas`, etc.)
- Grey font italic → usage examples
- Brown font italic → parenthetical clarification (appended to examples in parens)
- Remaining text nodes → definition text

**Not found:** `<h4 style="color:red">` containing "tidak ditemukan" — no suggestions provided.

## Color scheme (matches KBBI VI Daring brand)

| Variable | Value | Usage |
|----------|-------|-------|
| `--navy` | `#292261` | Primary (navbar, header, buttons) |
| `--navy-dark` | `#1b1640` | Hover state |
| `--red` | `#e60000` | Accent (gradient end, error) |
| `--gold` | `#c8a000` | K logo letter color |
| `--gold-light` | `#fdf6dc` | Def number bubble bg, label bg |

The entry card header uses `linear-gradient(to right, var(--navy), 60%, var(--red))` — same as the site's navbar.

## Icons

Extracted from `https://kbbi.kemendikdasmen.go.id/kbbi-daring-3.ico` using Pillow. Gold "K" on dark navy background. To regenerate:

```bash
python3 -c "
from PIL import Image
ico = Image.open('/tmp/kbbi-daring-3.ico')
ico.size = (16,16); ico.convert('RGBA').save('icons/icon16.png')
ico.size = (48,48); ico.convert('RGBA').save('icons/icon48.png')
ico.size = (48,48)
img128 = ico.convert('RGBA').resize((128,128), Image.LANCZOS)
img128.save('icons/icon128.png')
"
```
