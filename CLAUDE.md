# KBBI Chrome Extension — Claude Context

## Project overview

Manifest V3 Chrome extension that fetches Indonesian word definitions from kbbi.web.id. No build step, no bundler, no npm dependencies — plain HTML/CSS/JS files loaded directly by Chrome.

## Key architectural decisions

### No build tooling
All files are plain JS/CSS/HTML. Do not introduce bundlers (Webpack, Vite, etc.) unless the user explicitly asks. Shared modules (`kbbi.js`, `render.js`, `shared.css`) are loaded via `<script src>` and `<link rel=stylesheet>` in each HTML file.

### Data source: `#jsdata` JSON
kbbi.web.id renders definitions from a hidden `<div id="jsdata">` that contains a JSON array. The extension reads this directly rather than scraping visible HTML. This is the primary parse path. The HTML fallback (`parseFromHTML`) exists only as a safety net.

### Shared vs page-specific files
- `kbbi.js` — fetch + parse, no DOM side effects, no globals except `searchKBBI` and the internal helpers
- `render.js` — pure rendering functions (`renderResults`, `renderLoading`, `renderError`). Calls `onSuggestionClick(word)` which **must be defined** in the consuming page's JS (popup.js or results.js)
- `shared.css` — all styles; popup.html and results.html both link this
- `popup.js` / `results.js` — page controllers; each defines `onSuggestionClick`

### Context menu opens a new tab
`background.js` opens `results.html?word=…` in a new tab. Chrome MV3 service workers cannot programmatically open the extension popup, so this is the correct pattern.

## File map

| File | Role |
|------|------|
| `manifest.json` | MV3 config — permissions, icons, popup, service worker |
| `background.js` | Service worker — context menu registration + handler |
| `kbbi.js` | `searchKBBI(word)` — fetch + parse kbbi.web.id |
| `render.js` | `renderResults / renderLoading / renderError` — DOM rendering |
| `shared.css` | All CSS — used by both popup and results page |
| `popup.html` | Toolbar popup (380px wide) |
| `popup.js` | Popup controller; defines `onSuggestionClick` |
| `results.html` | Full-page results tab |
| `results.js` | Results controller; defines `onSuggestionClick`, updates URL |
| `icons/*.png` | 16/48/128px PNG icons |
| `generate-icons.js` | Node script to regenerate icons (not loaded by Chrome) |

## `searchKBBI` return shape

```js
{
  found: boolean,
  entries: Array<{
    word: string,
    definitions: Array<{
      type: 'definition' | 'compound',
      text: string,
      labels: string[],
      examples: string[]
    }>
  }>,
  suggestions: string[]
}
```

## Permissions in manifest.json

- `contextMenus` — right-click menu
- `tabs` — open results.html in new tab
- `host_permissions: https://kbbi.web.id/*` — CORS bypass for fetch

Do not add `storage` or `scripting` unless a feature explicitly needs them.

## How kbbi.web.id works (parser notes)

The `d` field in each JSON entry is an HTML string like:
```html
<b>ma·kan¹</b> <em>v</em>
<b>1</b> definition text <em>example</em>
<b>2</b> <span class="jk">ki</span> figurative meaning
```

Split on `<b>` tags whose text is purely numeric to get individual definitions. `<em>` under 5 all-alpha chars = grammar label; longer = usage example. `.jk` spans = labels.

`msg` field non-empty (contains "tidak ditemukan") = word not found.

## Suggestions (when not found)

`extractSuggestions(doc)` scans `a[href^="/"]` links with a single-segment path. These are word entry links kbbi.web.id renders when redirecting from an unknown word.

## Icons

Run `node generate-icons.js` to regenerate. The script uses Node's built-in `zlib` to produce valid PNG files — no external packages needed. To use better artwork, just replace the files in `icons/` directly (PNG, 16×16 / 48×48 / 128×128).
