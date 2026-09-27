# 1. Support two KBBI data sources with a developer-level switch

## Status

Accepted — implemented 2026-08-26.

## Context

Since the initial version, this extension fetched definitions from a
single source only: `kbbi.kemendikdasmen.go.id` (KBBI VI Daring, the
official Ministry site). The parser (`kbbi.js`) fetched that site directly
and parsed its HTML in place — there was no source abstraction layer at
all.

On 2026-08-26, while adding parser tests (`test/`, run in CI),
repeated attempts to capture a real HTML fixture from the official site
failed: anonymous `fetch` requests to `/entri/makan` and `/entri/rumah`
(tried with several different user agents) consistently returned a **"Moda
Terbatas"** ("Limited Mode") page asking the visitor to log in, instead of
definition HTML. This was then confirmed by driving the actual popup (an
unpacked extension load via Playwright): with the configuration active at
the time, searching for any word — including a common one like "makan" —
produced **"Kata tidak ditemukan di KBBI"** ("Word not found in KBBI").
Because the parser degrades this failure into `found: false` (not a thrown
error), the breakage was invisible at the code level — the extension
looked like it was working normally, it just failed every search. In
other words, the extension had likely already stopped working for every
user before this was noticed.

Meanwhile, `kbbi.web.id` — an unofficial mirror based on KBBI edition
III — turned out to be reachable without the same restriction. Its markup
is very different from the official site: instead of `<h2>` +
`<ol>/<li>` with colour-coded fonts per homonym, it's a single flat
`<div id="d1">` holding an entire homonym's content (numbered senses,
idioms, derived words), distinguishable only by the heuristic "is this
`<b>` tag's content a number or text?". Each homonym is also its own URL
(`/makan`, `/makan-2`, …), unlike the official site which puts all
homonyms on one page.

The core question: how do we add `kbbi.web.id` as a fallback source
without permanently locking the extension to a single source that can be
blocked at any time, while the official site remains the more
authoritative source (newer edition, official institution) once it's
reachable again?

## Options considered

1. **Just wait and monitor** — the official site's block might be
   temporary. Rejected: no certainty on when (or whether) it would be
   lifted, and the extension stays broken while waiting.
2. **Run a proxy/cache on developer-owned infrastructure** — build a
   backend that fetches from the official site and caches results.
   Rejected: adds infrastructure cost, ongoing maintenance, and a new
   single point of failure (the developer's own server), disproportionate
   for a simple, no-build-step extension.
3. **Switch entirely to `kbbi.web.id`**, removing the kemendikdasmen code.
   Rejected: `kbbi.web.id` is an unofficial mirror based on the older
   edition III; the official site remains the more desirable long-term
   source once reachable again. Deleting the existing code would also mean
   reimplementing that parser from scratch if/when the official site
   recovers.
4. **User-facing source picker** (a toggle in the popup, persisted via
   `chrome.storage`). Rejected for now: requires a new `storage`
   permission (a Chrome Web Store review), additional UI design, and
   complexity not yet justified — a developer-level switch is enough to
   handle a source outage.
5. **Thin dispatcher + per-source parsers, switched by a developer
   constant** (the option chosen) — see Decision below.

## Decision

`kbbi.js` was changed from a single monolithic fetch+parse file into a
**thin dispatcher**. Each data source has its own parser file under
`parsers/` (`parsers/kemendikdasmen.js`, `parsers/kbbiwebid.js`), and each
registers itself on `globalThis.KBBIParsers.<sourceId>` as
`{ buildUrl(word), parse(html), label }`. `kbbi.js` reads a single
constant, `ACTIVE_SOURCE`, and delegates fetch+parse to
`globalThis.KBBIParsers[ACTIVE_SOURCE]`.

To switch sources, a developer changes one line in `kbbi.js`:

```js
const ACTIVE_SOURCE = 'kbbiwebid'; // 'kemendikdasmen' | 'kbbiwebid'
```

then reloads the unpacked extension or ships a new version. This is
**deliberately** developer-only for now — no in-popup picker, no `storage`
permission used to persist a user's choice (see option 4 above for why
this was deferred, not rejected outright).

Both parsers return the identical `searchKBBI` shape (see `CLAUDE.md`), so
`render.js`/`popup.js`/`results.js` never need to know which source is
active. `render.js` gets the "view full entry" label and link through
`getActiveSource()`, exposed by `kbbi.js`, instead of hardcoding one
domain — this fixed a bug discovered during implementation (the link had
been hardcoded to the official domain regardless of which source was
actually in use).

`manifest.json`'s `host_permissions` includes **both** domains
(`kbbi.kemendikdasmen.go.id` and `kbbi.web.id`) from the start, even
though only one is active at a time — so switching sources in the future
never triggers a new Chrome Web Store permission review.

As of 2026-08-26, `ACTIVE_SOURCE` is set to `'kbbiwebid'` because the
official site is currently unreachable anonymously (see Context). The
mechanism for `kemendikdasmen` was not removed — its parser, fixtures, and
tests remain fully in place, ready to switch back to once the official
site is confirmed working again.

## Consequences

**Positive:**
- A single source's downtime becomes an incident resolvable in minutes
  (change one constant, ship a release) instead of an emergency
  from-scratch parser rewrite.
- Per-source parsing logic is isolated in its own file — a markup change
  on one site can't accidentally break the other site's parser, and each
  has its own tests/fixtures (`test/kemendikdasmen.test.js`,
  `test/kbbiwebid.test.js`).
- No additional permission is needed now or when switching sources in the
  future.

**Negative / trade-offs:**
- `kbbi.web.id` is an unofficial mirror based on KBBI edition III, not
  edition VI — definitions shown to users can be older or worded slightly
  differently than the official site while this source is active. This is
  documented in the README ("Known Limitations") and `privacy-policy.md`.
- `kbbi.web.id`'s markup has no structural separator between main senses,
  idioms, and derived words — the parser distinguishes them with a
  digit-vs-text heuristic on `<b>` tags, so the definition/compound split
  is a best-effort approximation, not a guaranteed 1:1 match to how the
  site itself groups them.
- Switching sources still requires a developer to change code and
  reload/ship a new release — there's no automatic failover when one
  source goes down, and end users can't pick a source themselves.
- Two parsers mean two surfaces that can break from site markup changes,
  instead of one — though the risk is mitigated by the per-file isolation
  and per-source tests described above.

## References

- `CLAUDE.md` — "Multi-source parsing: dispatcher + per-source parser
  files" section and each site's markup notes.
- PR #1 (`feat(parser): support two KBBI data sources`) — the
  implementing change.
- `README.md` — "Data sources" section.
