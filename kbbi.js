/**
 * Dispatches to the active KBBI data source's parser.
 *
 * Each source is implemented in its own file under parsers/ and registers
 * itself on globalThis.KBBIParsers (see parsers/kemendikdasmen.js and
 * parsers/kbbiwebid.js). Those files must be loaded — via <script src> in
 * the HTML pages, or via require() in tests — before this one.
 *
 * To switch the active source (e.g. if kbbi.kemendikdasmen.go.id is down),
 * change ACTIVE_SOURCE below and reload the unpacked extension / ship a new
 * version. This is a developer-only switch for now: there is no in-UI
 * source picker and no `storage` permission is used to persist a choice.
 */

const ACTIVE_SOURCE = 'kbbiwebid'; // 'kemendikdasmen' | 'kbbiwebid'
// kbbi.kemendikdasmen.go.id is blocking anonymous fetches with a "Moda
// Terbatas" login wall as of 2026-08-26 (see CLAUDE.md / TO-DO.md) — flip
// this back to 'kemendikdasmen' once that source is confirmed working again.

/**
 * The active source's { buildUrl(word), parse(html), label }. Used by
 * render.js to link back to the entry on the site it was actually fetched
 * from, rather than a hardcoded one.
 */
function getActiveSource() {
  return globalThis.KBBIParsers[ACTIVE_SOURCE];
}

/**
 * Fetch and parse a word from the active KBBI source.
 * @param {string} word
 * @returns {Promise<{found: boolean, entries: Array, suggestions: string[]}>}
 */
async function searchKBBI(word) {
  const source = getActiveSource();
  const url = source.buildUrl(word.trim());
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  return source.parse(html);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { searchKBBI, getActiveSource, ACTIVE_SOURCE };
}
