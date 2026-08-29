# KBBI Chrome Extension — Claude Context

## Project overview

Manifest V3 Chrome extension that fetches Indonesian word definitions from KBBI. Two sources are supported — **kbbi.kemendikdasmen.go.id** (KBBI VI Daring, official Ministry source) and **kbbi.web.id** (unofficial community mirror, based on KBBI III) — with the active one chosen by a developer-only constant, not a runtime setting. No build step, no bundler — plain HTML/CSS/JS files loaded directly by Chrome. A `package.json` with `jsdom` exists, but only as a devDependency for running parser tests in Node; it is not part of the shipped extension.

## Key architectural decisions

### No build tooling
All files are plain JS/CSS/HTML. Do not introduce bundlers (Webpack, Vite, etc.) unless the user explicitly asks. Shared modules (`kbbi.js`, `parsers/*.js`, `render.js`, `shared.css`) are loaded via `<script src>` and `<link rel=stylesheet>` in each HTML file, in that order — classic (non-module) scripts, so `parsers/*.js` must load before `kbbi.js`.

### Multi-source parsing: dispatcher + per-source parser files
`kbbi.js` is a thin dispatcher, not a parser. Each data source has its own file in `parsers/` that registers itself on `globalThis.KBBIParsers.<sourceId>` as `{ buildUrl(word), parse(html), label }`. `kbbi.js` reads a single constant, `ACTIVE_SOURCE`, and calls `globalThis.KBBIParsers[ACTIVE_SOURCE]`. Rationale and alternatives considered are recorded in [`docs/adr/0001-multi-source-kbbi-data.md`](docs/adr/0001-multi-source-kbbi-data.md).

**To switch the active source** (e.g. if one site is down or blocking anonymous requests): edit `ACTIVE_SOURCE` in `kbbi.js`, reload the unpacked extension (or ship a new version). This is intentionally developer-only for now — no in-popup source picker, no `storage` permission used to persist a choice. Both sources' `host_permissions` are already granted in `manifest.json` so switching never needs a new Chrome Web Store permission review.

Both parsers return the exact same shape (see `searchKBBI` return shape below) so `render.js`/`popup.js`/`results.js` never need to know which source is active.

### Data source markup differs completely between sources
- `kbbi.kemendikdasmen.go.id` renders standard server-side HTML: one `<h2>` per homonym, `<ol>/<ul>` definition lists, font-color-coded labels. See parser notes below.
- `kbbi.web.id` puts a single homonym's entire content — numbered senses, idioms, and derived word forms — into one flat `<div id="d1">`, told apart only by whether a `<b>` tag's content is a bare number or text. Each homonym is a separate URL (`/makan`, `/makan-2`, …), unlike the official site where multiple homonyms share one page. See parser notes below.

### Shared vs page-specific files
- `kbbi.js` — dispatcher only: reads `ACTIVE_SOURCE`, fetches, delegates parsing to the matching `parsers/*.js` module. No DOM side effects, exports only `searchKBBI`
- `parsers/kemendikdasmen.js`, `parsers/kbbiwebid.js` — one parser per source, each self-registering on `globalThis.KBBIParsers`
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
| `kbbi.js` | Dispatcher — `searchKBBI(word)` picks the active source and delegates to it |
| `parsers/kemendikdasmen.js` | Fetch URL + parser for kbbi.kemendikdasmen.go.id |
| `parsers/kbbiwebid.js` | Fetch URL + parser for kbbi.web.id |
| `render.js` | `renderResults / renderLoading / renderError` — DOM rendering |
| `shared.css` | All CSS — used by both popup and results page |
| `popup.html` | Toolbar popup (380px wide) |
| `popup.js` | Popup controller; defines `onSuggestionClick` |
| `results.html` | Full-page results tab |
| `results.js` | Results controller; defines `onSuggestionClick`, updates URL |
| `icons/*.png` | Extracted from official KBBI VI Daring favicon (gold K on navy) |
| `generate-icons.js` | Node fallback to regenerate icons (not loaded by Chrome) |
| `test/*.test.js` | `node:test` + `jsdom` parser tests, run via `npm test` and in CI |
| `docs/adr/*.md` | Architecture Decision Records — background/rationale for non-obvious structural decisions |
| `test/fixtures/kemendikdasmen/`, `test/fixtures/kbbiwebid/` | Saved HTML fixtures per source |

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

- `contextMenus` — right-click menu. `background.js` also calls `chrome.tabs.create` to open results.html in a new tab, which does not itself require the `tabs` permission in MV3 (manifest.json does not declare `tabs`; only reading other tabs' URLs/titles would need it).
- `host_permissions`:
  - `https://kbbi.web.id/*` — CORS bypass for fetch (currently active source, since 2026-08-26)
  - `https://kbbi.kemendikdasmen.go.id/*` — CORS bypass for fetch (standby source, granted upfront so switching `ACTIVE_SOURCE` back never needs a new Web Store permission review)

Do not add `storage` or `scripting` unless a feature explicitly needs them.

## How kbbi.kemendikdasmen.go.id works (`parsers/kemendikdasmen.js`)

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

**⚠️ Known live issue (observed 2026-08-26):** anonymous `fetch` requests to this site currently return a "Moda Terbatas" login-wall page instead of results, for every word. The parser degrades gracefully (`found: false`, indistinguishable from a genuine "not in dictionary" result) rather than throwing, but this means the extension would be effectively non-functional on this source until the site's access policy changes or the parser is taught to detect the login wall specifically. This is why `ACTIVE_SOURCE` is currently set to `'kbbiwebid'` instead — flip it back once this source is confirmed working again.

## How kbbi.web.id works (`parsers/kbbiwebid.js`)

**URL:** `GET /{word}` — each homonym is its own page (`/makan`, `/makan-2`, …), unlike the official site.

**Everything lives in one container**, `<div id="d1">`, no font-color coding:
```html
<div id="d1">
  <b>ma&#183;kan<sup>1</sup></b> <em>v</em> definisi pertama:
  <em>mereka -- tiga kali sehari</em>;
  <b>2</b> <em>v</em> definisi kedua: <em>ia sedang -- pisang</em>;
  ...
  <b>-- angin</b> <em>ki</em> definisi idiom;
  <br/><br/>
  <b>me&#183;ma&#183;kan</b> <em>v</em> definisi kata turunan;
</div>
```

- First `<b>` in the div = the headword (with `<sup>` homonym number); middle dot `·` is normalized to `.` to match the official site's word-field convention.
- Every subsequent `<b>` is classified purely by content: **bare digits** (`<b>2</b>`) start a new numbered top-level `definition`; **anything else** (`<b>-- angin</b>`, `<b>me·ma·kan</b>`) starts a new `compound` entry (idiom or derived/inflected word form). Numbered `<b>` tags encountered *inside* a compound block are nested sub-senses, kept inline in that compound's text rather than split out.
- The first `<em>` right after a marker is treated as the grammar/usage label (e.g. `v`, `n`, `ki`) if it's short alphabetic text with no `--`; later `<em>` tags in the same block are treated as examples.
- `--` stands in for the headword in examples on the live site. The parser drops bare `--` tokens rather than substituting the real word back in — a known simplification.
- **Not found:** `<div id="d1">` contains a `<span class="notfound">`.

This markup has no structural separators for "main sense list" vs. "idioms" vs. "derived words" — they're distinguished only by the digit-vs-text heuristic above, so the split is a best-effort approximation, not a guaranteed 1:1 match to how the site itself groups them.

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
